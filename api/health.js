module.exports = function health(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json");
  response.statusCode = 200;
  response.end(JSON.stringify({ ok: true, service: "recipe-basket-builder" }));
};
