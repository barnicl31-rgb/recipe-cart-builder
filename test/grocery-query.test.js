const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildGrocerySearchQueries,
  canonicalizeGroceryQuery,
  rankProductChoices
} = require("../lib/groceryQuery");

test("recipe lines become concise grocery search terms", () => {
  const examples = new Map([
    ["2 tbsp olive oil", "olive oil"],
    ["2 garlic cloves (, minced)", "garlic"],
    ["1 tsp cumin powder", "cumin powder"],
    ["1 teaspoon kosher salt", "salt"],
    ["0.5 cup sliced fresh mushrooms", "mushroom"],
    ["1 (10.5 ounce) can beef broth", "beef broth"],
    ["500 g / 1 lb lamb mince ((ground lamb, or beef) (Note 1))", "lamb mince"],
    ["1 (1.5-quart) container chocolate ice cream", "chocolate ice cream"],
    ["1 (16-ounce) container frozen whipped topping, thawed", "whipped cream"]
  ]);

  for (const [original, expected] of examples) {
    assert.equal(canonicalizeGroceryQuery(original), expected, original);
  }
});

test("search queries include controlled fallbacks without recipe measurements", () => {
  assert.deepEqual(
    buildGrocerySearchQueries({ original: "1 tsp ground cumin" }),
    ["cumin powder", "cumin"]
  );

  assert.deepEqual(
    buildGrocerySearchQueries({
      grocery_search_term: "cream",
      original: "1 (1.5-quart) container chocolate ice cream"
    }),
    ["chocolate ice cream", "ice cream", "cream"]
  );

  assert.deepEqual(
    buildGrocerySearchQueries({ original: "1 (16-ounce) container frozen whipped topping, thawed" }),
    ["whipping cream", "whipped cream", "cream"]
  );
});

test("exact products rank above cheaper similar products", () => {
  const ranked = rankProductChoices([
    { productName: "Cooking Oil", brand: "Value", packSize: "1 L", price: 80, similar: true },
    { productName: "Extra Virgin Olive Oil", brand: "Choice", packSize: "500 ml", price: 350, similar: false }
  ], "olive oil");

  assert.equal(ranked[0].productName, "Extra Virgin Olive Oil");
});
