const test = require("node:test");
const assert = require("node:assert/strict");

const { createSwiggyTrace, summarizeProductResult } = require("../lib/swiggyTrace");

test("Swiggy traces fingerprint addresses without exposing the address ID", () => {
  const trace = createSwiggyTrace("saved-address-123");

  assert.match(trace.traceId, /^[0-9a-f-]{36}$/);
  assert.match(trace.addressRef, /^[0-9a-f]{12}$/);
  assert.notEqual(trace.addressRef, "saved-address-123");
});

test("product summaries record schema counts without product details", () => {
  const summary = summarizeProductResult({
    success: true,
    data: {
      products: [{
        displayName: "Milk",
        variations: [{ spinId: "one" }, { spinId: "two" }]
      }],
      similarProducts: []
    }
  });

  assert.equal(summary.success, true);
  assert.equal(summary.arrayCounts["data.products"], 1);
  assert.equal(summary.arrayCounts["data.products[].variations"], 2);
  assert.equal(summary.arrayCounts["data.similarProducts"], 0);
  assert.equal(JSON.stringify(summary).includes("Milk"), false);
  assert.equal(JSON.stringify(summary).includes("spinId"), false);
});
