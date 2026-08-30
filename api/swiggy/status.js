const { sendJson, setExtensionCors } = require("../../lib/http");
const { readSwiggySession } = require("../../lib/swiggySession");

module.exports = async function swiggyStatus(request, response) {
  if (request.method === "OPTIONS") {
    setExtensionCors(request, response);
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    const session = readSwiggySession(request);
    setExtensionCors(request, response, session.extensionId);
    sendJson(response, 200, {
      connected: true,
      expires_at: new Date(session.expiresAt).toISOString()
    });
  } catch (error) {
    setExtensionCors(request, response);
    sendJson(response, error.status || 401, {
      connected: false,
      message: error.message
    });
  }
};
