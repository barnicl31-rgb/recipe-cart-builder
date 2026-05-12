(() => {
  const recipes = findRecipesFromJsonLd();

  if (recipes.length > 0) {
    const recipe = recipes[0];

    return {
      type: "recipe",
      name: asText(recipe.name),
      ingredients: asArray(recipe.recipeIngredient).map(asText).filter(Boolean),
      yield: asText(recipe.recipeYield)
    };
  }

  const selectedText = window.getSelection().toString().trim();

  if (selectedText) {
    return {
      type: "selectedText",
      text: selectedText
    };
  }

  return { type: "none" };

  function findRecipesFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const foundRecipes = [];

    scripts.forEach((script) => {
      const parsedJson = safeParseJson(script.textContent);

      if (parsedJson) {
        collectRecipes(parsedJson, foundRecipes);
      }
    });

    return foundRecipes.filter((recipe) => asArray(recipe.recipeIngredient).length > 0);
  }

  function safeParseJson(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn("Recipe Basket Builder could not parse JSON-LD:", error);
      return null;
    }
  }

  function collectRecipes(value, recipes) {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectRecipes(item, recipes));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (isRecipe(value)) {
      recipes.push(value);
    }

    if (Array.isArray(value["@graph"])) {
      value["@graph"].forEach((item) => collectRecipes(item, recipes));
    }
  }

  function isRecipe(value) {
    return asArray(value["@type"]).some((type) => String(type).toLowerCase() === "recipe");
  }

  function asArray(value) {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  function asText(value) {
    if (Array.isArray(value)) {
      return value.map(asText).filter(Boolean).join(", ");
    }

    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }
})();
