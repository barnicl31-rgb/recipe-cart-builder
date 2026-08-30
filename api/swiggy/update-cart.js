const { readJsonBody, sendJson, setExtensionCors } = require("../../lib/http");
const { createInstamartClient, getToolData } = require("../../lib/swiggyMcp");
const { readSwiggySession } = require("../../lib/swiggySession");

module.exports = async function updateCart(request, response) {
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
    const selectedAddressId = String(body.selectedAddressId || "").trim();
    const items = normalizeItems(body.items);

    if (!selectedAddressId || items.length === 0) {
      sendJson(response, 400, { success: false, message: "Choose at least one Instamart product." });
      return;
    }

    const instamart = await createInstamartClient(session.accessToken);
    let cartResult;

    try {
      await instamart.callTool("update_cart", {
        selectedAddressId,
        items
      });
      cartResult = await instamart.callTool("get_cart", {});
    } finally {
      await instamart.close();
    }

    sendJson(response, 200, {
      success: true,
      message: "The Instamart cart now contains your selected products. Review the live total and availability in Swiggy before checkout.",
      cart: getToolData(cartResult)
    });
  } catch (error) {
    setExtensionCors(request, response);
    sendJson(response, error.status || 502, { success: false, message: error.message });
  }
};

function normalizeItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 50).flatMap((item) => {
    const spinId = String(item?.spinId || "").trim();
    const skuId = String(item?.skuId || "").trim();
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(item?.quantity) || 1)));

    if (!spinId) {
      return [];
    }

    return [{
      spinId,
      ...(skuId ? { skuId } : {}),
      quantity
    }];
  });
}
