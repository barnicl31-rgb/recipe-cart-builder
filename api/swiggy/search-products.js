const { readJsonBody, sendJson, setExtensionCors } = require("../../lib/http");
const { buildGrocerySearchQueries, rankProductChoices } = require("../../lib/groceryQuery");
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
        const queries = buildGrocerySearchQueries(ingredient);

        if (!queries.length) {
          continue;
        }

        let selectedQuery = queries[0];
        let allChoices = [];
        let similarFallback = [];
        let similarFallbackQuery = queries[0];
        let unavailableCount = 0;
        let swiggyMessage = "";

        for (const query of queries) {
          const result = await instamart.callTool("search_products", {
            addressId,
            query: query.slice(0, 120)
          });
          const choices = extractProductChoices(result);
          unavailableCount += choices.unavailableProducts.length;
          swiggyMessage ||= choices.message;

          if (!similarFallback.length && choices.similarProducts.length) {
            similarFallback = rankProductChoices(choices.similarProducts, query);
            similarFallbackQuery = query;
          }

          if (choices.products.length) {
            selectedQuery = query;
            allChoices = rankProductChoices(
              [...choices.products, ...choices.similarProducts],
              query
            );
            break;
          }
        }

        if (!allChoices.length) {
          allChoices = similarFallback;
          selectedQuery = similarFallbackQuery;
        }

        matches.push({
          ingredient: ingredient.original || ingredient.item || queries[0],
          query: selectedQuery,
          attemptedQueries: queries,
          choices: deduplicateChoices(allChoices).slice(0, 12),
          reason: allChoices.length ? "" : buildNoMatchReason(unavailableCount, swiggyMessage)
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

function buildNoMatchReason(unavailableCount, swiggyMessage) {
  if (unavailableCount > 0) {
    return "Products were found, but none are currently available for this delivery address.";
  }

  return swiggyMessage || "Swiggy returned no available products for this delivery address.";
}

function deduplicateChoices(choices) {
  const seen = new Set();

  return choices.filter((choice) => {
    const key = `${choice.spinId}:${choice.skuId || ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
