const { readJsonBody, sendJson, setExtensionCors } = require("../../lib/http");
const { createInstamartClient, extractProductChoices } = require("../../lib/swiggyMcp");
const { readSwiggySession } = require("../../lib/swiggySession");

module.exports = async function searchProducts(request, response) {
  if (request.method === "OPTIONS") {
    setExtensionCors(request, response);
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.end();
    return;
  }

  try {
    const session = readSwiggySession(request);
    setExtensionCors(request, response, session.extensionId);
    const body = await readJsonBody(request);
    const addressId = String(body.addressId || "").trim();
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients.slice(0, 30) : [];

    if (!addressId || ingredients.length === 0) {
      sendJson(response, 400, { success: false, message: "Choose an address and at least one ingredient." });
      return;
    }

    const matches = [];
    const instamart = await createInstamartClient(session.accessToken);

    try {
      for (const ingredient of ingredients) {
        const query = String(ingredient.grocery_search_term || ingredient.item || ingredient.original || "").trim().slice(0, 120);

        if (!query) {
          continue;
        }

        const result = await instamart.callTool("search_products", {
          addressId,
          query
        });
        const choices = extractProductChoices(result);
        const allChoices = [...choices.products, ...choices.similarProducts]
          .sort((left, right) => sortPrice(left.price) - sortPrice(right.price))
          .slice(0, 12);

        matches.push({
          ingredient: ingredient.original || query,
          query,
          choices: allChoices
        });
      }
    } finally {
      await instamart.close();
    }

    sendJson(response, 200, { success: true, addressId, matches });
  } catch (error) {
    setExtensionCors(request, response);
    sendJson(response, error.status || 502, { success: false, message: error.message });
  }
};

function sortPrice(price) {
  return Number.isFinite(Number(price)) ? Number(price) : Number.MAX_SAFE_INTEGER;
}
