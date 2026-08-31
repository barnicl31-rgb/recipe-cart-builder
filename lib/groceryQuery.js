const catalog = [
  entry("garlic powder", ["powdered garlic"]),
  entry("onion powder", ["powdered onion"]),
  entry("cumin powder", ["ground cumin"]),
  entry("coriander powder", ["ground coriander"]),
  entry("cardamom powder", ["ground cardamom"]),
  entry("chili powder", ["chilli powder", "red chili powder", "red chilli powder"]),
  entry("turmeric powder", ["ground turmeric"]),
  entry("black pepper", ["ground pepper", "freshly ground pepper", "pepper"]),
  entry("salt", ["kosher salt", "sea salt", "table salt", "fine salt", "coarse salt"]),
  entry("olive oil", ["extra virgin olive oil", "evoo"]),
  entry("cooking oil", ["vegetable oil", "sunflower oil", "canola oil"]),
  entry("basmati rice", ["long grain basmati rice"]),
  entry("beef broth", ["beef stock", "low sodium beef broth"]),
  entry("chicken broth", ["chicken stock", "low sodium chicken broth"]),
  entry("vegetable broth", ["vegetable stock", "veggie broth", "veggie stock"]),
  entry("lamb mince", ["ground lamb", "minced lamb", "mutton mince"]),
  entry("beef mince", ["ground beef", "minced beef"]),
  entry("chicken drumsticks", ["drumsticks", "chicken legs"]),
  entry("coconut milk", ["canned coconut milk"]),
  entry("tomato paste", ["tomato puree", "tomato concentrate"]),
  entry("soy sauce", ["light soy sauce", "dark soy sauce"]),
  entry("bell pepper", ["capsicum", "green bell pepper", "red bell pepper", "yellow bell pepper"]),
  entry("spring onion", ["spring onions", "scallion", "scallions", "green onion", "green onions"]),
  entry("coriander leaves", ["cilantro", "fresh coriander", "fresh cilantro"]),
  entry("mushroom", ["mushrooms", "button mushrooms", "sliced mushrooms", "fresh mushrooms"]),
  entry("garlic", ["garlic clove", "garlic cloves", "cloves garlic"]),
  entry("ginger", ["ginger root", "fresh ginger"]),
  entry("tomato", ["tomatoes", "cherry tomatoes", "roma tomatoes"]),
  entry("onion", ["onions", "red onion", "white onion", "yellow onion"]),
  entry("potato", ["potatoes"]),
  entry("carrot", ["carrots"]),
  entry("egg", ["eggs"]),
  entry("milk", ["whole milk", "low fat milk", "skim milk"]),
  entry("butter", ["salted butter", "unsalted butter"]),
  entry("yogurt", ["yoghurt", "plain yogurt", "greek yogurt"]),
  entry("chocolate ice cream", ["chocolate icecream"]),
  entry("ice cream", ["icecream"]),
  entry("sour cream", []),
  entry("cream cheese", []),
  entry("whipped cream", ["whipped topping", "frozen whipped topping"]),
  entry("whipping cream", ["heavy whipping cream"]),
  entry("cream", ["heavy cream", "cooking cream", "fresh cream"]),
  entry("flour", ["all purpose flour", "plain flour", "maida"]),
  entry("brown sugar", ["light brown sugar", "dark brown sugar"]),
  entry("sugar", ["white sugar", "granulated sugar", "caster sugar"]),
  entry("chickpeas", ["garbanzo beans", "chana"]),
  entry("lentils", ["red lentils", "green lentils", "dal", "dhal"]),
  entry("shrimp", ["prawn", "prawns"]),
  entry("lemon", ["lemons"]),
  entry("lime", ["limes"]),
  entry("parsley", ["fresh parsley"]),
  entry("mint", ["fresh mint", "mint leaves"]),
  entry("basil", ["fresh basil"])
];

const aliases = catalog
  .flatMap((product) => product.aliases.map((alias) => ({ alias, term: product.term })))
  .sort((left, right) => right.alias.length - left.alias.length);

const fallbackTerms = new Map([
  ["olive oil", ["oil"]],
  ["cumin powder", ["cumin"]],
  ["coriander powder", ["coriander"]],
  ["cardamom powder", ["cardamom"]],
  ["turmeric powder", ["turmeric"]],
  ["black pepper", ["pepper"]],
  ["chocolate ice cream", ["ice cream"]],
  ["sour cream", ["cream"]],
  ["whipped cream", ["whipping cream", "cream"]],
  ["whipping cream", ["cream"]],
  ["cream cheese", ["cheese"]]
]);

function buildGrocerySearchQueries(ingredient) {
  const values = [
    ingredient?.grocery_search_term,
    ingredient?.item,
    ingredient?.original,
    ingredient
  ];
  const queries = [];

  for (const value of values) {
    const query = canonicalizeGroceryQuery(value);

    if (query && !queries.includes(query)) {
      queries.push(query);
    }

    const fallbacks = fallbackTerms.get(query) || [];

    for (const fallback of fallbacks) {
      if (!queries.includes(fallback)) {
        queries.push(fallback);
      }
    }
  }

  return queries
    .sort((left, right) => querySpecificity(right) - querySpecificity(left))
    .slice(0, 3);
}

function canonicalizeGroceryQuery(value) {
  let phrase = normalizeText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\[\{][^\]\}]*[\]\}]/g, " ")
    .replace(/^\s*(?:about|approximately|approx\.?|around)\s+/i, "")
    .replace(/^\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*/i, "")
    .replace(/^\s*(?:cups?|tablespoons?|tbsp|teaspoons?|tsp|grams?|g|kilograms?|kg|milliliters?|ml|liters?|l|ounces?|oz|pounds?|lbs?|pinches?|cans?|packets?|pieces?|slices?|containers?|packages?|packs?|cartons?|boxes?|bags?|bottles?|jars?|tubs?|trays?)\b\s*/i, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:g|kg|ml|l|oz|lb|lbs|ounce|ounces|gram|grams|kilogram|kilograms|milliliter|milliliters|liter|liters|pound|pounds)\b/gi, " ")
    .replace(/[,;].*$/, " ")
    .replace(/\b(?:to taste|as needed|optional|divided|for serving|plus more|or more)\b.*$/i, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const directMatch = findCatalogMatch(phrase);

  if (directMatch) {
    return directMatch;
  }

  phrase = phrase
    .replace(/\b(?:freshly|fresh|finely|roughly|thinly|thickly|chopped|diced|sliced|minced|crushed|peeled|grated|shredded|rinsed|drained|softened|melted|large|small|medium)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return findCatalogMatch(phrase) || phrase;
}

function rankProductChoices(choices, query) {
  const queryTokens = tokenize(query);

  return choices.slice().sort((left, right) => {
    const scoreDifference = scoreChoice(right, query, queryTokens) - scoreChoice(left, query, queryTokens);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return sortablePrice(left.price) - sortablePrice(right.price);
  });
}

function scoreChoice(choice, query, queryTokens) {
  const searchable = normalizeText([choice.productName, choice.brand, choice.packSize].filter(Boolean).join(" "));
  const matchingTokens = queryTokens.filter((token) => searchable.includes(token)).length;
  let score = matchingTokens * 20;

  if (searchable.includes(normalizeText(query))) {
    score += 80;
  }
  if (queryTokens.length && matchingTokens === queryTokens.length) {
    score += 40;
  }
  if (choice.similar) {
    score -= 25;
  }

  return score;
}

function findCatalogMatch(value) {
  const match = aliases.find((candidate) => containsPhrase(value, candidate.alias));
  return match?.term || "";
}

function containsPhrase(value, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(value);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[¼]/g, "1/4")
    .replace(/[½]/g, "1/2")
    .replace(/[¾]/g, "3/4")
    .replace(/[⅓]/g, "1/3")
    .replace(/[⅔]/g, "2/3")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value).split(/\s+/).filter((token) => token.length > 1);
}

function sortablePrice(value) {
  return Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER;
}

function querySpecificity(value) {
  return tokenize(value).length * 100 + value.length;
}

function entry(term, alternativeNames) {
  return { term, aliases: [term, ...alternativeNames] };
}

module.exports = {
  buildGrocerySearchQueries,
  canonicalizeGroceryQuery,
  rankProductChoices
};
