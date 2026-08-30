const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const INSTAMART_ENDPOINT = process.env.SWIGGY_MCP_ENDPOINT || "https://mcp.swiggy.com/im";

async function createInstamartClient(accessToken) {
  const provider = createBearerOAuthProvider(accessToken);
  const client = new Client({
    name: "recipe-basket-builder",
    version: "0.2.0"
  }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(INSTAMART_ENDPOINT), {
    authProvider: provider
  });

  try {
    await client.connect(transport);
  } catch (error) {
    try {
      await transport.close();
    } catch (closeError) {
      // Connection failed; cleanup is best-effort.
    }

    throw mapInstamartError(error);
  }

  return {
    async callTool(name, args = {}) {
      try {
        const result = await client.callTool({ name, arguments: args });
        return normalizeToolResult(result);
      } catch (error) {
        throw mapInstamartError(error);
      }
    },
    async close() {
      try {
        await transport.close();
      } catch (error) {
        // The requests have completed; transport cleanup is best-effort.
      }
    }
  };
}

async function callInstamartTool(accessToken, name, args = {}) {
  const instamart = await createInstamartClient(accessToken);

  try {
    return await instamart.callTool(name, args);
  } finally {
    await instamart.close();
  }
}

function mapInstamartError(error) {
  if (error?.status === 401 || error?.code === -32001) {
    error.status = 401;
    error.message = "Your Swiggy session has expired. Connect again.";
  }

  return error;
}

function createBearerOAuthProvider(accessToken) {
  const tokens = {
    access_token: accessToken,
    token_type: "Bearer"
  };

  return {
    get redirectUrl() {
      return undefined;
    },
    get clientMetadata() {
      return { client_name: "Recipe Basket Builder" };
    },
    clientInformation() {
      return undefined;
    },
    tokens() {
      return tokens;
    },
    saveTokens() {},
    redirectToAuthorization() {
      throw new Error("Swiggy reauthorization is required.");
    },
    saveCodeVerifier() {},
    codeVerifier() {
      throw new Error("No PKCE verifier is available for a bearer-only request.");
    }
  };
}

function normalizeToolResult(result) {
  if (result?.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent;
  }

  const textBlocks = Array.isArray(result?.content)
    ? result.content.filter((block) => block.type === "text" && block.text)
    : [];

  for (const block of textBlocks) {
    try {
      return JSON.parse(block.text);
    } catch (error) {
      // Keep looking in case another text block contains the JSON payload.
    }
  }

  return result;
}

function getToolData(result) {
  if (result?.success === false) {
    const error = new Error(result.error?.message || result.message || "Swiggy MCP tool call failed.");
    error.body = result;
    throw error;
  }

  return result?.data ?? result;
}

function extractAddresses(result) {
  const data = getToolData(result);

  if (Array.isArray(data)) {
    return data;
  }

  return findArray(data, ["addresses", "items", "results"]);
}

function extractProductChoices(result) {
  const data = getToolData(result);
  const products = Array.isArray(data?.products) ? data.products : findArray(data, ["products"]);
  const similarProducts = Array.isArray(data?.similarProducts) ? data.similarProducts : [];

  return {
    products: products.flatMap((product) => normalizeProduct(product, false)),
    similarProducts: similarProducts.flatMap((product) => normalizeProduct(product, true))
  };
}

function normalizeProduct(product, similar) {
  if (product?.inStock === false || product?.isAvail === false) {
    return [];
  }

  const variations = Array.isArray(product?.variations)
    ? product.variations
    : Array.isArray(product?.variants)
      ? product.variants
      : [];

  return variations
    .filter((variation) => (
      variation?.spinId &&
      variation?.available !== false &&
      variation?.inStock !== false &&
      variation?.isInStockAndAvailable !== false
    ))
    .map((variation) => ({
      spinId: String(variation.spinId),
      skuId: variation.skuId ? String(variation.skuId) : null,
      productId: product.productId ? String(product.productId) : null,
      parentProductId: product.parentProductId ? String(product.parentProductId) : null,
      productName: String(product.name || product.displayName || product.productName || variation.name || "Product"),
      brand: String(product.brand || product.brandName || variation.brandName || ""),
      packSize: String(
        variation.quantityDescription ||
        variation.displayName ||
        variation.packSize ||
        variation.name ||
        ""
      ),
      price: findPrice(variation),
      imageUrl: String(variation.imageUrl || product.imageUrl || ""),
      maxQuantity: Number.isFinite(Number(variation.maxQuantity)) ? Number(variation.maxQuantity) : null,
      similar
    }));
}

function findPrice(value) {
  const candidates = [
    value?.price?.offerPrice,
    value?.price?.mrp,
    value?.offerPrice,
    value?.discountedPrice,
    value?.finalPrice,
    value?.price,
    value?.mrp
  ];
  const price = candidates.find((candidate) => Number.isFinite(Number(candidate)));
  return price === undefined ? null : Number(price);
}

function findArray(value, keys) {
  if (!value || typeof value !== "object") {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const found = findArray(nested, keys);

      if (found.length) {
        return found;
      }
    }
  }

  return [];
}

module.exports = {
  callInstamartTool,
  createInstamartClient,
  extractAddresses,
  extractProductChoices,
  getToolData
};
