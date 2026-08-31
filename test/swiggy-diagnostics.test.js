const test = require("node:test");
const assert = require("node:assert/strict");

const { assessAddressCatalogue } = require("../lib/swiggyDiagnostics");

const emptyResult = {
  choices: [],
  unavailableCount: 0,
  message: "",
  error: ""
};

test("address diagnostics distinguish a working milk search", () => {
  const assessment = assessAddressCatalogue(
    { ...emptyResult, choices: [{ spinId: "milk-1" }] },
    emptyResult
  );

  assert.equal(assessment.code, "search_working");
});

test("address diagnostics separate available go-to items from empty search", () => {
  const assessment = assessAddressCatalogue(
    emptyResult,
    { ...emptyResult, choices: [{ spinId: "usual-1" }] }
  );

  assert.equal(assessment.code, "search_empty_go_to_items_present");
});

test("address diagnostics identify unavailable catalogue records", () => {
  const assessment = assessAddressCatalogue(
    { ...emptyResult, unavailableCount: 2 },
    emptyResult
  );

  assert.equal(assessment.code, "catalogue_unavailable");
});

test("address diagnostics report an empty search and empty go-to items", () => {
  const assessment = assessAddressCatalogue(emptyResult, emptyResult);

  assert.equal(assessment.code, "search_and_go_to_empty");
});
