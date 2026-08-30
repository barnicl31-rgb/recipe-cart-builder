const { sendJson, setExtensionCors } = require("../../lib/http");
const { callInstamartTool, extractAddresses } = require("../../lib/swiggyMcp");
const { readSwiggySession } = require("../../lib/swiggySession");

module.exports = async function getAddresses(request, response) {
  if (request.method === "OPTIONS") {
    setExtensionCors(request, response);
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    const session = readSwiggySession(request);
    setExtensionCors(request, response, session.extensionId);
    const result = await callInstamartTool(session.accessToken, "get_addresses", {});
    const addresses = extractAddresses(result).map(summarizeAddress).filter((address) => address.id);

    sendJson(response, 200, { success: true, addresses });
  } catch (error) {
    setExtensionCors(request, response);
    sendJson(response, error.status || 502, { success: false, message: error.message });
  }
};

function summarizeAddress(address) {
  return {
    id: String(address.id || address.addressId || ""),
    label: String(address.label || address.name || address.type || "Saved address"),
    display: String(
      address.displayAddress ||
      address.formattedAddress ||
      address.address ||
      [address.addressLine1, address.addressLine2, address.city].filter(Boolean).join(", ") ||
      "Saved Swiggy address"
    )
  };
}
