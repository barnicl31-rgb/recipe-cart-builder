const { readJsonBody, sendJson, setExtensionCors } = require("../../lib/http");
const { rankProductChoices } = require("../../lib/groceryQuery");
const { assessAddressCatalogue } = require("../../lib/swiggyDiagnostics");
const { createInstamartClient, extractProductChoices } = require("../../lib/swiggyMcp");
const { readSwiggySession } = require("../../lib/swiggySession");

module.exports = async function diagnoseAddress(request, response) {
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

    if (!addressId) {
      sendJson(response, 400, { success: false, message: "Choose a saved Swiggy address." });
      return;
    }

    const instamart = await createInstamartClient(session.accessToken);
    let milkSearch;
    let goToItems;

    try {
      milkSearch = await callDiagnosticTool(instamart, "search_products", {
        addressId,
        query: "milk"
      }, "milk");
      goToItems = await callDiagnosticTool(instamart, "your_go_to_items", {
        addressId
      }, "");
    } finally {
      await instamart.close();
    }

    const assessment = assessAddressCatalogue(milkSearch, goToItems);

    sendJson(response, 200, {
      success: true,
      addressId,
      query: "milk",
      assessment: assessment.code,
      message: assessment.message,
      search: milkSearch,
      goToItems
    });
  } catch (error) {
    setExtensionCors(request, response);
    sendJson(response, error.status || 502, { success: false, message: error.message });
  }
};

async function callDiagnosticTool(instamart, tool, args, query) {
  try {
    const result = await instamart.callTool(tool, args);
    const choices = extractProductChoices(result);
    const available = rankProductChoices(
      [...choices.products, ...choices.similarProducts],
      query
    );

    return {
      choices: deduplicateChoices(available).slice(0, 12),
      unavailableCount: choices.unavailableProducts.length,
      message: choices.message || "",
      error: ""
    };
  } catch (error) {
    return {
      choices: [],
      unavailableCount: 0,
      message: "",
      error: error.message || `${tool} failed.`
    };
  }
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
