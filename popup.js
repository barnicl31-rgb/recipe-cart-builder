const extractButton = document.getElementById("extractButton");
const statusElement = document.getElementById("status");
const resultsElement = document.getElementById("results");

const API_BASE_URLS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

extractButton.addEventListener("click", async () => {
  setLoading(true);
  setStatus("Scanning the page...");
  resultsElement.innerHTML = "";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error("No active tab found.");
    }

    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    const extractedData = injectionResult?.result;
    await renderExtractedData(extractedData);
  } catch (error) {
    console.error(error);
    setStatus("Could not scan this page. Try another recipe page.");
  } finally {
    setLoading(false);
  }
});

async function renderExtractedData(data) {
  if (!data) {
    setStatus("No data returned from the page.");
    return;
  }

  if (data.type === "recipe") {
    setStatus("");
    const normalizedIngredients = await normalizeIngredients(data.ingredients);
    renderRecipe(data, normalizedIngredients);
    return;
  }

  if (data.type === "selectedText") {
    setStatus("");
    renderSelectedText(data.text);
    return;
  }

  setStatus("No structured recipe found. Try highlighting the ingredients and clicking Extract again.");
}

async function normalizeIngredients(ingredients) {
  for (const apiBaseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/normalize-ingredients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ingredients })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // The popup can still show extracted ingredients if the local API is offline.
    }
  }

  setStatus("Ingredients extracted. Start or restart the backend to see cleaned grocery terms.");
  return null;
}

function renderRecipe(recipe, normalizedIngredients) {
  const title = document.createElement("h2");
  title.textContent = recipe.name || "Recipe found";

  resultsElement.appendChild(title);

  if (recipe.yield) {
    const yieldElement = document.createElement("p");
    yieldElement.className = "recipe-yield";
    yieldElement.textContent = `Yield: ${recipe.yield}`;
    resultsElement.appendChild(yieldElement);
  }

  const list = document.createElement("ul");
  list.className = "ingredient-list";

  recipe.ingredients.forEach((ingredient, index) => {
    const normalized = normalizedIngredients?.[index];
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");

    checkbox.type = "checkbox";
    checkbox.dataset.index = String(index);
    text.textContent = normalized
      ? `${ingredient} (${normalized.grocery_search_term})`
      : ingredient;

    label.appendChild(checkbox);
    label.appendChild(text);

    const item = document.createElement("li");
    item.appendChild(label);
    list.appendChild(item);
  });

  if (recipe.ingredients.length > 0) {
    resultsElement.appendChild(createChecklistActions(list));
  }

  resultsElement.appendChild(list);

  if (recipe.ingredients.length > 0) {
    resultsElement.appendChild(createBasketButton(list, recipe, normalizedIngredients));
  }
}

function createBasketButton(list, recipe, normalizedIngredients) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "basket-button";
  button.textContent = "Build Basket";
  button.addEventListener("click", async () => {
    const checkedIngredients = getCheckedIngredients(list, recipe, normalizedIngredients);

    if (checkedIngredients.length === 0) {
      setStatus("Select at least one ingredient before building a basket.");
      return;
    }

    await openSwiggyInstamart(checkedIngredients);
    setStatus("Opened Swiggy Instamart and started the add-to-basket helper. Review the basket before checkout.");
  });

  return button;
}

function getCheckedIngredients(list, recipe, normalizedIngredients) {
  const checkedBoxes = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));

  return checkedBoxes.map((checkbox) => {
    const index = Number(checkbox.dataset.index);
    const original = recipe.ingredients[index];
    const normalized = normalizedIngredients?.[index];

    return normalized || {
      original,
      item: original,
      quantity: null,
      unit: null,
      grocery_search_term: original
    };
  });
}

async function openSwiggyInstamart(ingredients) {
  const uniqueSearchTerms = getUniqueSearchTerms(ingredients);
  const firstSearchTerm = uniqueSearchTerms[0];
  const tab = await chrome.tabs.create({
    url: firstSearchTerm
      ? buildSwiggySearchUrl(firstSearchTerm)
      : "https://www.swiggy.com/instamart",
    active: true
  });

  await chrome.storage.local.set({
    recipeBasketBuilderTerms: uniqueSearchTerms
  });

  injectSwiggyAutomationWhenReady(tab.id);
}

function injectSwiggyAutomationWhenReady(tabId) {
  chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") {
      return;
    }

    chrome.tabs.onUpdated.removeListener(listener);

    chrome.scripting.executeScript({
      target: { tabId },
      files: ["swiggyAutomation.js"]
    });
  });
}

function getUniqueSearchTerms(ingredients) {
  const searchTerms = ingredients.map((ingredient) => {
    return ingredient.grocery_search_term || ingredient.item || ingredient.original;
  });

  return Array.from(new Set(searchTerms.filter(Boolean)));
}

function buildSwiggySearchUrl(searchTerm) {
  const query = encodeURIComponent(searchTerm);

  return `https://www.swiggy.com/instamart/search?query=${query}`;
}

function createChecklistActions(list) {
  const actions = document.createElement("div");
  const toggleButton = document.createElement("button");

  actions.className = "checklist-actions";

  toggleButton.type = "button";
  toggleButton.className = "secondary-button";
  updateChecklistToggleButton(list, toggleButton);

  toggleButton.addEventListener("click", () => {
    const shouldSelectAll = !areAllCheckboxesChecked(list);
    setAllCheckboxes(list, shouldSelectAll);
    updateChecklistToggleButton(list, toggleButton);
  });

  list.addEventListener("change", () => {
    updateChecklistToggleButton(list, toggleButton);
  });

  actions.appendChild(toggleButton);

  return actions;
}

function setAllCheckboxes(container, isChecked) {
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    checkbox.checked = isChecked;
  });
}

function areAllCheckboxesChecked(container) {
  const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));

  return checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
}

function updateChecklistToggleButton(container, button) {
  button.textContent = areAllCheckboxesChecked(container) ? "Deselect all" : "Select all";
}

function renderSelectedText(text) {
  const title = document.createElement("h2");
  const rawText = document.createElement("pre");

  title.textContent = "Selected text found";
  rawText.textContent = text;

  resultsElement.appendChild(title);
  resultsElement.appendChild(rawText);
}

function setStatus(message) {
  statusElement.textContent = message;
}

function setLoading(isLoading) {
  extractButton.disabled = isLoading;
  extractButton.textContent = isLoading ? "Extracting..." : "Extract Ingredients";
}
