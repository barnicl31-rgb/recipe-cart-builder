const SWIGGY_MCP_ENDPOINT = process.env.SWIGGY_MCP_ENDPOINT || "https://mcp.swiggy.com/im";

function isSwiggyConfigured() {
  return Boolean(getSwiggyAccessToken());
}

function getSwiggyAccessToken() {
  return process.env.SWIGGY_TOKEN || process.env.SWIGGY_ACCESS_TOKEN || "";
}

async function callInstamartTool(name, args = {}) {
  const token = getSwiggyAccessToken();

  if (!token) {
    const error = new Error("Swiggy MCP access token is not configured.");
    error.code = "SWIGGY_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(SWIGGY_MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name,
        arguments: args
      },
      id: Date.now()
    })
  });

  if (!response.ok) {
    const error = new Error(`Swiggy MCP returned HTTP ${response.status}`);
    error.status = response.status;
    error.body = await response.text();
    throw error;
  }

  const payload = await response.json();

  if (payload.error) {
    const error = new Error(payload.error.message || "Swiggy MCP tool call failed.");
    error.body = payload.error;
    throw error;
  }

  return payload.result;
}

async function buildInstamartCart(ingredients) {
  const addresses = await callInstamartTool("get_addresses", {});
  const selectedAddress = pickDeliveryAddress(addresses);

  if (!selectedAddress?.id) {
    throw new Error("No Swiggy delivery address was returned by get_addresses.");
  }

  const productMatches = [];

  for (const ingredient of ingredients) {
    const query = ingredient.grocery_search_term || ingredient.item || ingredient.original;
    const searchResult = await callInstamartTool("search_products", {
      addressId: selectedAddress.id,
      query
    });
    const selectedVariant = pickFirstVariant(searchResult);

    productMatches.push({
      ingredient,
      query,
      search_result: searchResult,
      selected_variant: selectedVariant
    });
  }

  return {
    success: false,
    requires_product_selection: true,
    selected_address: selectedAddress,
    product_matches: productMatches,
    cart: null,
    message: "Review and choose a specific Instamart variant for each ingredient before updating the cart."
  };
}

function createInstamartToolPlan(ingredients) {
  return {
    server: "instamart",
    endpoint: SWIGGY_MCP_ENDPOINT,
    flow: [
      {
        tool: "get_addresses",
        arguments: {}
      },
      ...ingredients.map((ingredient) => ({
        tool: "search_products",
        arguments: {
          addressId: "<address id from get_addresses>",
          query: ingredient.grocery_search_term || ingredient.item || ingredient.original
        }
      })),
      {
        tool: "update_cart",
        arguments: {
          selectedAddressId: "<address id from get_addresses>",
          items: [{ spinId: "<spin id from chosen product variant>", quantity: 1 }]
        }
      },
      {
        tool: "get_cart",
        arguments: {}
      }
    ],
    checkout_note: "Do not call checkout until the user has reviewed the cart and explicitly confirmed the order."
  };
}

function pickDeliveryAddress(addressesResult) {
  const addresses = extractArray(addressesResult, ["addresses", "data", "items"]);

  return addresses.find((address) => String(address.label || "").toLowerCase() === "home") || addresses[0];
}

function pickFirstVariant(searchResult) {
  const products = extractArray(searchResult, ["products", "data", "items", "results"]);

  for (const product of products) {
    const variant = findSpinVariant(product);

    if (variant) {
      return {
        spinId: variant.spinId,
        product_name: product.name || product.displayName || product.productName || variant.name || "",
        variant_name: variant.name || variant.displayName || variant.packSize || "",
        raw: variant
      };
    }
  }

  return null;
}

function findSpinVariant(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.spinId) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSpinVariant(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  for (const nestedValue of Object.values(value)) {
    const found = findSpinVariant(nestedValue);

    if (found) {
      return found;
    }
  }

  return null;
}

function extractArray(value, preferredKeys) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }

    if (value[key] && typeof value[key] === "object") {
      const nestedArray = extractArray(value[key], preferredKeys);

      if (nestedArray.length > 0) {
        return nestedArray;
      }
    }
  }

  return [];
}

module.exports = {
  buildInstamartCart,
  callInstamartTool,
  createInstamartToolPlan,
  isSwiggyConfigured
};
