const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SWIGGY_SESSION_SECRET = "test-only-secret-that-is-longer-than-thirty-two-characters";

const { seal, unseal } = require("../lib/secureSession");
const { createSwiggySession, readSwiggySession } = require("../lib/swiggySession");

test("secure envelopes round-trip and reject tampering", () => {
  const envelope = seal({ hello: "world" }, "test-purpose");
  assert.deepEqual(unseal(envelope, "test-purpose"), { hello: "world" });

  const tampered = `${envelope.slice(0, -1)}${envelope.endsWith("a") ? "b" : "a"}`;
  assert.throws(() => unseal(tampered, "test-purpose"), /could not be verified/);
});

test("Swiggy sessions are bound to the Chrome extension that created them", () => {
  const extensionId = "a".repeat(32);
  const envelope = createSwiggySession({
    access_token: "secret-token",
    token_type: "Bearer",
    expires_in: 3600
  }, extensionId);
  const request = {
    headers: {
      authorization: `RecipeBasket ${envelope}`,
      origin: `chrome-extension://${extensionId}`
    }
  };

  assert.equal(readSwiggySession(request).accessToken, "secret-token");

  request.headers.origin = `chrome-extension://${"b".repeat(32)}`;
  assert.throws(() => readSwiggySession(request), /another extension installation/);
});
