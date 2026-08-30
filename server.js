const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  buildInstamartCart,
  createInstamartToolPlan,
  isSwiggyConfigured
} = require("./swiggyMcpClient");

const port = Number(process.env.PORT || 3000);
const learningStorePath = path.join(__dirname, "learning-store.json");
let lastNormalizedIngredients = [];
let lastSuggestedBasket = [];
let learningStore = loadLearningStore();

const server = http.createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/") {
    sendHtml(response, 200, renderDebugPage());
    return;
  }

  if (request.method === "GET" && request.url === "/admin/learning") {
    sendHtml(response, 200, renderLearningAdminPage());
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && request.url === "/api/last-normalized") {
    sendJson(response, 200, lastNormalizedIngredients);
    return;
  }

  if (request.method === "GET" && request.url === "/api/last-basket") {
    sendJson(response, 200, lastSuggestedBasket);
    return;
  }

  if (request.method === "GET" && request.url === "/api/learned-mappings") {
    sendJson(response, 200, learningStore);
    return;
  }

  if (request.method === "GET" && request.url === "/api/swiggy/status") {
    sendJson(response, 200, {
      configured: isSwiggyConfigured(),
      endpoint: process.env.SWIGGY_MCP_ENDPOINT || "https://mcp.swiggy.com/im",
      note: "Set SWIGGY_TOKEN or SWIGGY_ACCESS_TOKEN to enable live Instamart MCP calls."
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/normalize-ingredients") {
    const body = await readJsonBody(request);
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : [];
    const normalizedIngredients = ingredients.map(normalizeIngredient);

    lastNormalizedIngredients = normalizedIngredients;
    sendJson(response, 200, normalizedIngredients);
    return;
  }

  if (request.method === "POST" && request.url === "/api/search-groceries") {
    const body = await readJsonBody(request);
    const searchTerms = Array.isArray(body?.search_terms) ? body.search_terms : [];
    const searchResults = searchTerms.map((searchTerm) => {
      return searchMockGroceryProvider(String(searchTerm || ""));
    });

    sendJson(response, 200, searchResults);
    return;
  }

  if (request.method === "POST" && request.url === "/api/build-basket") {
    const body = await readJsonBody(request);
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : [];
    const basket = buildSuggestedBasket(ingredients);

    lastSuggestedBasket = basket;
    sendJson(response, 200, basket);
    return;
  }

  if (request.method === "POST" && request.url === "/api/swiggy/plan-cart") {
    const body = await readJsonBody(request);
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : [];

    sendJson(response, 200, createInstamartToolPlan(ingredients));
    return;
  }

  if (request.method === "POST" && request.url === "/api/swiggy/build-cart") {
    const body = await readJsonBody(request);
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : [];

    if (!isSwiggyConfigured()) {
      sendJson(response, 428, {
        success: false,
        configured: false,
        message: "Swiggy MCP is not configured. Set SWIGGY_TOKEN or SWIGGY_ACCESS_TOKEN, then restart the backend.",
        plan: createInstamartToolPlan(ingredients)
      });
      return;
    }

    try {
      const cartResult = await buildInstamartCart(ingredients);
      sendJson(response, cartResult.success ? 200 : 422, cartResult);
    } catch (error) {
      sendJson(response, error.status || 500, {
        success: false,
        message: error.message,
        detail: error.body || null
      });
    }

    return;
  }

  if (request.method === "POST" && request.url === "/api/learn-ingredient") {
    const body = await readJsonBody(request);
    const learnedMapping = learnIngredientMapping(body);

    sendJson(response, learnedMapping ? 200 : 400, learnedMapping || { error: "Missing ingredient or search term" });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Recipe Basket Builder API running at http://localhost:${port}`);
});

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

function renderDebugPage() {
  const normalizedContent = lastNormalizedIngredients.length
    ? JSON.stringify(lastNormalizedIngredients, null, 2)
    : "No ingredients have been normalized yet. Extract a recipe with the extension, then refresh this page.";
  const basketContent = lastSuggestedBasket.length
    ? JSON.stringify(lastSuggestedBasket, null, 2)
    : "No basket has been built yet. Click Build Basket in the extension after extracting ingredients.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Recipe Basket Builder API</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f7f5ef;
        color: #1f2933;
        font-family: Arial, sans-serif;
      }

      main {
        max-width: 820px;
        margin: 0 auto;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      p {
        margin: 0 0 16px;
        color: #52606d;
      }

      pre {
        overflow: auto;
        padding: 16px;
        border: 1px solid #d9d2c2;
        border-radius: 6px;
        background: #fffdfa;
        line-height: 1.45;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Recipe Basket Builder API</h1>
      <p>Most recent normalized ingredients:</p>
      <pre>${escapeHtml(normalizedContent)}</pre>
      <p>Most recent suggested basket:</p>
      <pre>${escapeHtml(basketContent)}</pre>
    </main>
  </body>
</html>`;
}

function renderLearningAdminPage() {
  const mappingsJson = JSON.stringify(learningStore.mappings, null, 2);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Recipe Basket Builder Learning Admin</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f7f5ef;
        color: #1f2933;
        font-family: Arial, sans-serif;
      }

      main {
        max-width: 920px;
        margin: 0 auto;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }

      p {
        margin: 0 0 18px;
        color: #52606d;
      }

      form {
        display: grid;
        gap: 12px;
        padding: 16px;
        border: 1px solid #d9d2c2;
        border-radius: 12px;
        background: #fffdfa;
      }

      label {
        display: grid;
        gap: 6px;
        font-weight: 700;
      }

      input {
        border: 1px solid #b9c8c1;
        border-radius: 8px;
        padding: 10px;
        font-size: 14px;
      }

      button {
        border: 0;
        border-radius: 8px;
        padding: 11px 14px;
        background: #256f5c;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }

      pre {
        overflow: auto;
        margin-top: 18px;
        padding: 16px;
        border: 1px solid #d9d2c2;
        border-radius: 12px;
        background: #fffdfa;
        line-height: 1.45;
      }

      .status {
        min-height: 20px;
        margin-top: 12px;
        color: #256f5c;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Learning Admin</h1>
      <p>Add backend keyword mappings here. These mappings improve future ingredient normalization without cluttering the extension popup.</p>

      <form id="learningForm">
        <label>
          Ingredient phrase
          <input id="original" type="text" placeholder="Example: 500 g lamb mince ((ground lamb, or beef))" required>
        </label>
        <label>
          Grocery search term
          <input id="searchTerm" type="text" placeholder="Example: lamb mince" required>
        </label>
        <button type="submit">Save mapping</button>
      </form>

      <div id="status" class="status" aria-live="polite"></div>

      <h2>Current mappings</h2>
      <pre id="mappings">${escapeHtml(mappingsJson)}</pre>
    </main>

    <script>
      const form = document.getElementById("learningForm");
      const statusElement = document.getElementById("status");
      const mappingsElement = document.getElementById("mappings");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const response = await fetch("/api/learn-ingredient", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            original: document.getElementById("original").value,
            grocery_search_term: document.getElementById("searchTerm").value
          })
        });

        if (!response.ok) {
          statusElement.textContent = "Could not save mapping.";
          return;
        }

        statusElement.textContent = "Mapping saved.";
        form.reset();
        await refreshMappings();
      });

      async function refreshMappings() {
        const response = await fetch("/api/learned-mappings");
        const mappings = await response.json();
        mappingsElement.textContent = JSON.stringify(mappings.mappings, null, 2);
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readJsonBody(request) {
  return new Promise((resolve) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });

    request.on("error", () => {
      resolve({});
    });
  });
}

function loadLearningStore() {
  try {
    const savedLearningStore = fs.readFileSync(learningStorePath, "utf8");
    const parsedLearningStore = JSON.parse(savedLearningStore);

    return {
      mappings: Array.isArray(parsedLearningStore.mappings) ? parsedLearningStore.mappings : []
    };
  } catch (error) {
    return { mappings: [] };
  }
}

function saveLearningStore() {
  fs.writeFileSync(learningStorePath, JSON.stringify(learningStore, null, 2));
}

function learnIngredientMapping(body) {
  const originalIngredient = String(body?.original || "").trim();
  const searchTerm = cleanItemName(body?.grocery_search_term || body?.search_term || "");

  if (!originalIngredient || !searchTerm) {
    return null;
  }

  const rawItem = cleanItemName(removeParentheticalText(normalizeText(originalIngredient)));
  const ingredientKey = createLearningKey(rawItem || originalIngredient);
  const now = new Date().toISOString();
  const existingMapping = learningStore.mappings.find((mapping) => {
    return mapping.ingredient_key === ingredientKey;
  });

  if (existingMapping) {
    existingMapping.grocery_search_term = searchTerm;
    existingMapping.times_confirmed += 1;
    existingMapping.updated_at = now;
    saveLearningStore();
    return existingMapping;
  }

  const mapping = {
    ingredient_key: ingredientKey,
    example_original: originalIngredient,
    normalized_item: rawItem,
    grocery_search_term: searchTerm,
    times_confirmed: 1,
    created_at: now,
    updated_at: now
  };

  learningStore.mappings.push(mapping);
  saveLearningStore();
  return mapping;
}

function normalizeIngredient(originalIngredient) {
  const original = String(originalIngredient || "").trim();
  const normalizedOriginal = normalizeText(original);
  const withoutNotes = removeParentheticalText(normalizedOriginal);
  const quantityMatch = withoutNotes.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/);
  const quantity = quantityMatch ? parseQuantity(quantityMatch[1].replace(/\s+/g, " ")) : null;
  const afterQuantity = quantityMatch
    ? withoutNotes.slice(quantityMatch[0].length).trim()
    : withoutNotes;

  const unitMatch = afterQuantity.match(/^([a-zA-Z]+)\b/);
  const possibleUnit = unitMatch ? singularize(unitMatch[1].toLowerCase()) : "";
  const unit = knownUnits.has(possibleUnit) ? possibleUnit : null;
  const rawItem = unit
    ? afterQuantity.slice(unitMatch[0].length).trim()
    : afterQuantity;
  const item = cleanItemName(rawItem);
  const grocerySearchTerm = findBestGrocerySearchTerm(item);

  return {
    original,
    item: grocerySearchTerm,
    quantity,
    unit,
    grocery_search_term: grocerySearchTerm
  };
}

function buildSuggestedBasket(ingredients) {
  return ingredients.map((ingredient) => {
    const searchTerm = ingredient.grocery_search_term || ingredient.item || ingredient.original || "";
    const productMatch = searchMockGroceryProvider(searchTerm);

    return {
      ingredient: ingredient.original || searchTerm,
      item: ingredient.item || productMatch.search_term,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit || null,
      provider: productMatch.provider,
      grocery_search_term: productMatch.search_term,
      matched_product: productMatch.product_name,
      package_size: productMatch.package_size,
      estimated_price: productMatch.estimated_price,
      confidence: productMatch.confidence,
      product_url: productMatch.product_url
    };
  });
}

function searchMockGroceryProvider(searchTerm) {
  const normalizedSearchTerm = findBestGrocerySearchTerm(searchTerm);
  const directMatch = mockGroceryProducts.find((product) => {
    return product.search_terms.some((term) => term === normalizedSearchTerm);
  });
  const fuzzyMatch = mockGroceryProducts.find((product) => {
    return product.search_terms.some((term) => {
      return containsPhrase(normalizedSearchTerm, term) || containsPhrase(term, normalizedSearchTerm);
    });
  });
  const matchedProduct = directMatch || fuzzyMatch;

  if (matchedProduct) {
    return {
      provider: "mock_grocery",
      search_term: normalizedSearchTerm,
      product_name: matchedProduct.product_name,
      package_size: matchedProduct.package_size,
      estimated_price: matchedProduct.estimated_price,
      confidence: directMatch ? "high" : "medium",
      product_url: buildSearchUrl(normalizedSearchTerm)
    };
  }

  return {
    provider: "mock_grocery",
    search_term: normalizedSearchTerm,
    product_name: `Search for "${normalizedSearchTerm}"`,
    package_size: null,
    estimated_price: null,
    confidence: "low",
    product_url: buildSearchUrl(normalizedSearchTerm)
  };
}

function buildSearchUrl(searchTerm) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} grocery`)}`;
}

function parseQuantity(value) {
  if (value.includes(" ")) {
    const [wholeNumber, fraction] = value.split(" ");
    const parsedFraction = parseQuantity(fraction);
    return Number(wholeNumber) + parsedFraction;
  }

  if (value.includes("/")) {
    const [top, bottom] = value.split("/").map(Number);
    return bottom ? top / bottom : null;
  }

  return Number(value);
}

function cleanItemName(value) {
  const cleanedValue = normalizeText(value)
    .replace(/\/\s*\d+(?:\.\d+)?\s*(?:lb|lbs|pound|pounds|oz|ounce|ounces|g|gram|grams|kg|kilogram|kilograms)\b/g, "")
    .replace(/^of\s+/i, "")
    .replace(/,\s*.*/, "")
    .replace(/\b(to taste|as needed|divided|optional|plus more|for serving)\b/g, "")
    .replace(/\b(freshly ground|fresh|ground|sliced|chopped|diced|minced|kosher|sea|fine|coarse|large|small|medium)\b/g, "")
    .replace(/[()[\]{}]/g, "")
    .replace(/\s+\/\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return cleanedValue;
}

function removeParentheticalText(value) {
  let result = "";
  let depth = 0;

  for (const character of value) {
    if (character === "(") {
      depth += 1;
      continue;
    }

    if (character === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      result += character;
    }
  }

  return result.replace(/\s+/g, " ").trim();
}

function singularize(value) {
  return value.endsWith("s") ? value.slice(0, -1) : value;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[¼]/g, "1/4")
    .replace(/[½]/g, "1/2")
    .replace(/[¾]/g, "3/4")
    .replace(/[⅓]/g, "1/3")
    .replace(/[⅔]/g, "2/3")
    .replace(/[⅛]/g, "1/8")
    .replace(/[⅜]/g, "3/8")
    .replace(/[⅝]/g, "5/8")
    .replace(/[⅞]/g, "7/8")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findBestGrocerySearchTerm(item) {
  const normalizedItem = normalizeText(item);
  const learnedMatch = findLearnedGrocerySearchTerm(normalizedItem);

  if (learnedMatch) {
    return learnedMatch;
  }

  const directMatch = groceryCatalog.find((product) => product.term === normalizedItem);

  if (directMatch) {
    return directMatch.term;
  }

  const aliasesBySpecificity = groceryCatalog
    .flatMap((product) => {
      return product.aliases.map((alias) => ({
        alias,
        term: product.term
      }));
    })
    .sort((left, right) => right.alias.length - left.alias.length);
  const aliasMatch = aliasesBySpecificity.find((product) => {
    return containsPhrase(normalizedItem, product.alias);
  });

  if (aliasMatch) {
    return aliasMatch.term;
  }

  return normalizedItem;
}

function findLearnedGrocerySearchTerm(item) {
  const itemKey = createLearningKey(item);
  const exactMatch = learningStore.mappings.find((mapping) => mapping.ingredient_key === itemKey);

  if (exactMatch) {
    return exactMatch.grocery_search_term;
  }

  const phraseMatch = learningStore.mappings
    .slice()
    .sort((left, right) => right.ingredient_key.length - left.ingredient_key.length)
    .find((mapping) => {
      return containsPhrase(itemKey, mapping.ingredient_key) || containsPhrase(mapping.ingredient_key, itemKey);
    });

  return phraseMatch?.grocery_search_term || null;
}

function createLearningKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(value, phrase) {
  const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const phrasePattern = new RegExp(`(^|\\s)${escapedPhrase}(\\s|$)`, "i");

  return phrasePattern.test(value);
}

const knownUnits = new Set([
  "cup",
  "tablespoon",
  "tbsp",
  "teaspoon",
  "tsp",
  "gram",
  "g",
  "kilogram",
  "kg",
  "milliliter",
  "ml",
  "liter",
  "l",
  "ounce",
  "oz",
  "pound",
  "lb",
  "pinch",
  "clove",
  "slice",
  "can",
  "packet",
  "piece"
]);

const groceryCatalog = [
  product("salt", ["kosher salt", "sea salt", "table salt", "fine salt", "coarse salt"]),
  product("pepper", ["black pepper", "white pepper", "ground pepper", "freshly ground pepper"]),
  product("garlic powder", ["garlic powder"]),
  product("onion powder", ["onion powder"]),
  product("paprika", ["smoked paprika", "sweet paprika"]),
  product("cumin", ["ground cumin", "cumin powder"]),
  product("coriander", ["ground coriander", "coriander powder"]),
  product("turmeric", ["turmeric powder", "ground turmeric"]),
  product("chili powder", ["chilli powder", "red chili powder", "red chilli powder"]),
  product("cinnamon", ["ground cinnamon", "cinnamon powder"]),
  product("sugar", ["white sugar", "granulated sugar", "caster sugar"]),
  product("brown sugar", ["light brown sugar", "dark brown sugar"]),
  product("flour", ["all purpose flour", "plain flour", "maida"]),
  product("rice", ["white rice", "long grain rice"]),
  product("basmati rice", ["basmati rice"]),
  product("pasta", ["spaghetti", "penne", "macaroni", "fusilli"]),
  product("bread", ["sliced bread", "sandwich bread"]),
  product("butter", ["unsalted butter", "salted butter"]),
  product("oil", ["vegetable oil", "cooking oil"]),
  product("olive oil", ["extra virgin olive oil", "evoo"]),
  product("milk", ["whole milk", "low fat milk", "skim milk"]),
  product("cream", ["heavy cream", "cooking cream", "whipping cream"]),
  product("yogurt", ["plain yogurt", "greek yogurt", "yoghurt"]),
  product("egg", ["eggs"]),
  product("cheese", ["cheddar cheese", "mozzarella cheese", "parmesan cheese"]),
  product("tomato", ["tomatoes", "roma tomatoes", "cherry tomatoes"]),
  product("tomato paste", ["tomato puree", "tomato concentrate"]),
  product("onion", ["onions", "red onion", "white onion", "yellow onion"]),
  product("garlic", ["garlic cloves", "cloves garlic"]),
  product("ginger", ["fresh ginger", "ginger root"]),
  product("mushroom", ["mushrooms", "button mushrooms", "sliced mushrooms", "fresh mushrooms"]),
  product("potato", ["potatoes"]),
  product("carrot", ["carrots"]),
  product("bell pepper", ["capsicum", "green bell pepper", "red bell pepper", "yellow bell pepper"]),
  product("lemon", ["lemons"]),
  product("lime", ["limes"]),
  product("cilantro", ["fresh cilantro", "coriander leaves", "fresh coriander"]),
  product("parsley", ["fresh parsley"]),
  product("mint", ["fresh mint", "mint leaves"]),
  product("basil", ["fresh basil"]),
  product("chicken", ["chicken breast", "chicken thighs", "chicken thigh"]),
  product("drumsticks", ["chicken drumsticks", "drumstick"]),
  product("beef broth", ["beef stock"]),
  product("chicken broth", ["chicken stock"]),
  product("vegetable broth", ["vegetable stock", "veggie broth", "veggie stock"]),
  product("beef", ["ground beef", "beef mince"]),
  product("lamb mince", ["ground lamb", "minced lamb"]),
  product("fish", ["white fish", "fish fillet"]),
  product("shrimp", ["prawns", "prawn"]),
  product("lentils", ["red lentils", "green lentils", "dal", "dhal"]),
  product("chickpeas", ["garbanzo beans", "chana"]),
  product("beans", ["black beans", "kidney beans", "white beans"]),
  product("coconut milk", ["canned coconut milk"]),
  product("soy sauce", ["light soy sauce", "dark soy sauce"]),
  product("vinegar", ["white vinegar", "apple cider vinegar"]),
  product("honey", ["raw honey"]),
  product("mustard", ["dijon mustard", "yellow mustard"])
];

function product(term, aliases) {
  return {
    term,
    aliases: [term, ...aliases]
  };
}

const mockGroceryProducts = [
  mockProduct("Salt", "1 kg", "KWD 0.350", ["salt"]),
  mockProduct("Black Pepper Powder", "100 g", "KWD 0.750", ["pepper", "black pepper"]),
  mockProduct("Garlic Powder", "100 g", "KWD 0.850", ["garlic powder"]),
  mockProduct("Fresh Button Mushrooms", "250 g", "KWD 0.950", ["mushroom"]),
  mockProduct("Beef Broth", "400 ml", "KWD 0.850", ["beef broth", "beef stock"]),
  mockProduct("Chicken Broth", "400 ml", "KWD 0.750", ["chicken broth", "chicken stock"]),
  mockProduct("Chicken Drumsticks", "1 kg", "KWD 1.950", ["drumsticks", "chicken drumsticks"]),
  mockProduct("Basmati Rice", "5 kg", "KWD 3.250", ["basmati rice"]),
  mockProduct("Fresh Onion", "1 kg", "KWD 0.390", ["onion"]),
  mockProduct("Fresh Garlic", "250 g", "KWD 0.450", ["garlic"]),
  mockProduct("Olive Oil", "500 ml", "KWD 2.250", ["olive oil"]),
  mockProduct("Cooking Oil", "1.5 l", "KWD 1.100", ["oil"]),
  mockProduct("Milk", "1 l", "KWD 0.550", ["milk"]),
  mockProduct("Eggs", "15 pieces", "KWD 1.250", ["egg"]),
  mockProduct("Tomatoes", "1 kg", "KWD 0.650", ["tomato"])
];

function mockProduct(productName, packageSize, estimatedPrice, searchTerms) {
  return {
    product_name: productName,
    package_size: packageSize,
    estimated_price: estimatedPrice,
    search_terms: searchTerms
  };
}
