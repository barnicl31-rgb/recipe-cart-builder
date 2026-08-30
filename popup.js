const extractButton = document.getElementById("extractButton");
const connectSwiggyButton = document.getElementById("connectSwiggyButton");
const disconnectSwiggyButton = document.getElementById("disconnectSwiggyButton");
const swiggyConnectionDot = document.getElementById("swiggyConnectionDot");
const swiggyConnectionText = document.getElementById("swiggyConnectionText");
const statusElement = document.getElementById("status");
const resultsElement = document.getElementById("results");

const LOCAL_API_BASE_URLS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const SWIGGY_API_BASE_URL = "https://recipe-basket-builder.vercel.app";
const INSTAMART_URL = "https://www.swiggy.com/instamart";

let swiggyConnected = false;

refreshSwiggyStatus();

connectSwiggyButton.addEventListener("click", async () => {
  connectSwiggyButton.disabled = true;
  swiggyConnectionText.textContent = "Opening Swiggy sign-in...";

  try {
    const result = await chrome.runtime.sendMessage({ type: "connectSwiggy" });

    if (!result?.success) {
      throw new Error(result?.message || "Swiggy connection was not completed.");
    }

    setSwiggyConnection(true, "Swiggy connected");
    setStatus("Swiggy connected successfully.");
  } catch (error) {
    console.error("Could not connect Swiggy:", error);
    setSwiggyConnection(false, "Swiggy not connected");
    setStatus("Swiggy connection was not completed. Please try again.");
  } finally {
    connectSwiggyButton.disabled = false;
  }
});

disconnectSwiggyButton.addEventListener("click", async () => {
  try {
    await clearSwiggySession();
    setSwiggyConnection(false, "Swiggy not connected");
    setStatus("Swiggy was disconnected from this extension.");
  } catch (error) {
    setStatus(error.message);
  }
});

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

    await renderExtractedData(injectionResult?.result);
  } catch (error) {
    console.error(error);
    setStatus("Could not scan this page. Try another recipe page.");
  } finally {
    setLoading(false);
  }
});

async function refreshSwiggyStatus() {
  try {
    const session = await getSwiggySession();

    if (!session) {
      setSwiggyConnection(false, "Swiggy not connected");
      return;
    }

    const result = await swiggyFetch("/api/swiggy/status");
    setSwiggyConnection(Boolean(result.connected), result.connected ? "Swiggy connected" : "Swiggy not connected");
  } catch (error) {
    setSwiggyConnection(false, "Reload extension");
    setStatus(error.message || "Reload Recipe Basket Builder and try again.");
  }
}

function setSwiggyConnection(connected, message) {
  swiggyConnected = connected;
  swiggyConnectionText.textContent = message;
  swiggyConnectionDot.classList.toggle("connected", connected);
  swiggyConnectionDot.classList.toggle("disconnected", !connected);
  connectSwiggyButton.hidden = connected;
  disconnectSwiggyButton.hidden = !connected;
}

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
  for (const apiBaseUrl of LOCAL_API_BASE_URLS) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/normalize-ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // The popup can still show extracted ingredients if the local API is offline.
    }
  }

  setStatus("Ingredients extracted. Start or restart the local backend to see cleaned grocery terms.");
  return null;
}

function renderRecipe(recipe, normalizedIngredients) {
  const normalizedList = normalizedIngredients || [];
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
    const normalized = normalizedList[index];
    const checkbox = document.createElement("input");
    const text = document.createElement("span");
    const label = document.createElement("label");
    const item = document.createElement("li");

    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset.index = String(index);
    text.textContent = normalized
      ? `${ingredient} (${normalized.grocery_search_term})`
      : ingredient;

    label.append(checkbox, text);
    item.appendChild(label);
    list.appendChild(item);
  });

  if (recipe.ingredients.length > 0) {
    resultsElement.appendChild(createChecklistActions(list));
  }

  resultsElement.appendChild(list);

  if (recipe.ingredients.length > 0) {
    resultsElement.appendChild(createBasketButton(list, recipe, normalizedList));
  }
}

function createChecklistActions(list) {
  const actions = document.createElement("div");
  const toggleButton = document.createElement("button");

  actions.className = "checklist-actions";
  toggleButton.type = "button";
  toggleButton.className = "secondary-button";
  updateChecklistToggleButton(list, toggleButton);

  toggleButton.addEventListener("click", () => {
    setAllCheckboxes(list, !areAllCheckboxesChecked(list));
    updateChecklistToggleButton(list, toggleButton);
  });
  list.addEventListener("change", () => updateChecklistToggleButton(list, toggleButton));
  actions.appendChild(toggleButton);
  return actions;
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

    if (!swiggyConnected) {
      setStatus("Connect Swiggy first, then click Build Basket again.");
      return;
    }

    button.disabled = true;
    button.textContent = "Finding products...";
    setStatus("Loading your saved Swiggy addresses...");

    try {
      const addressResult = await swiggyFetch("/api/swiggy/addresses");
      const addresses = addressResult.addresses || [];

      if (!addresses.length) {
        throw new Error("No saved Swiggy address was found. Add an address in Swiggy and try again.");
      }

      const selectedAddress = addresses.find((address) => address.label.toLowerCase() === "home") || addresses[0];
      await searchAndRenderProducts(checkedIngredients, addresses, selectedAddress.id);
    } catch (error) {
      setStatus(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Build Basket";
    }
  });

  return button;
}

async function searchAndRenderProducts(ingredients, addresses, addressId) {
  setStatus("Searching Instamart for each selected ingredient...");
  const searchResult = await swiggyFetch("/api/swiggy/search-products", {
    method: "POST",
    body: JSON.stringify({ addressId, ingredients })
  });

  renderProductReview(searchResult.matches || [], addresses, addressId, ingredients);
  setStatus("Review the suggested products before adding them to the Instamart cart.");
}

function renderProductReview(matches, addresses, addressId, ingredients) {
  resultsElement.querySelector(".product-review")?.remove();
  resultsElement.querySelector(".swiggy-result")?.remove();

  const section = document.createElement("section");
  const title = document.createElement("h2");
  const addressLabel = document.createElement("label");
  const addressSelect = document.createElement("select");
  const choiceList = document.createElement("ul");
  const addButton = document.createElement("button");

  section.className = "product-review";
  title.textContent = "Choose Instamart products";
  addressLabel.className = "field-label";
  addressLabel.append("Delivery address", addressSelect);
  choiceList.className = "product-choice-list";
  addButton.type = "button";
  addButton.className = "basket-button";
  addButton.textContent = "Add selected products";

  addresses.forEach((address) => {
    const option = document.createElement("option");
    option.value = address.id;
    option.textContent = `${address.label}: ${address.display}`;
    option.selected = address.id === addressId;
    addressSelect.appendChild(option);
  });

  addressSelect.addEventListener("change", async () => {
    addressSelect.disabled = true;

    try {
      await searchAndRenderProducts(ingredients, addresses, addressSelect.value);
    } catch (error) {
      setStatus(error.message);
      addressSelect.disabled = false;
    }
  });

  matches.forEach((match, index) => {
    const item = document.createElement("li");
    const ingredientName = document.createElement("strong");
    const queryText = document.createElement("small");
    const controls = document.createElement("div");
    const productSelect = document.createElement("select");
    const quantityInput = document.createElement("input");

    ingredientName.textContent = match.ingredient;
    queryText.textContent = `Search: ${match.query}`;
    controls.className = "choice-controls";
    productSelect.dataset.matchIndex = String(index);
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.max = "20";
    quantityInput.value = "1";
    quantityInput.setAttribute("aria-label", `Quantity for ${match.query}`);

    const skipOption = document.createElement("option");
    skipOption.value = "";
    skipOption.textContent = match.choices.length ? "Skip this ingredient" : "No matching product found";
    productSelect.appendChild(skipOption);

    match.choices.forEach((choice, choiceIndex) => {
      const option = document.createElement("option");
      option.value = String(choiceIndex);
      option.textContent = formatProductChoice(choice);
      option.selected = choiceIndex === 0;
      productSelect.appendChild(option);
    });

    if (!match.choices.length) {
      item.classList.add("empty-choice");
      productSelect.disabled = true;
      quantityInput.disabled = true;
    }

    controls.append(productSelect, quantityInput);
    item.append(ingredientName, queryText, controls);
    choiceList.appendChild(item);
  });

  addButton.addEventListener("click", async () => {
    const items = Array.from(choiceList.querySelectorAll("select[data-match-index]")).flatMap((select) => {
      if (select.value === "") {
        return [];
      }

      const match = matches[Number(select.dataset.matchIndex)];
      const choice = match.choices[Number(select.value)];
      const quantityInput = select.parentElement.querySelector('input[type="number"]');

      return [{
        spinId: choice.spinId,
        skuId: choice.skuId,
        quantity: Number(quantityInput.value) || 1
      }];
    });

    if (!items.length) {
      setStatus("Choose at least one product before updating the cart.");
      return;
    }

    addButton.disabled = true;
    addButton.textContent = "Updating cart...";

    try {
      const result = await swiggyFetch("/api/swiggy/update-cart", {
        method: "POST",
        body: JSON.stringify({
          selectedAddressId: addressSelect.value,
          items
        })
      });
      renderCartResult(result);
      setStatus("Instamart cart updated. Review it in Swiggy before checkout.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      addButton.disabled = false;
      addButton.textContent = "Add selected products";
    }
  });

  section.append(title, addressLabel, choiceList, addButton);
  resultsElement.appendChild(section);
}

function renderCartResult(result) {
  resultsElement.querySelector(".swiggy-result")?.remove();

  const section = document.createElement("section");
  const title = document.createElement("h2");
  const message = document.createElement("p");
  const actions = document.createElement("div");
  const reviewButton = document.createElement("button");
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const cart = document.createElement("pre");

  section.className = "swiggy-result";
  title.textContent = "Instamart cart ready";
  message.textContent = result.message || "Your selected products were added to the cart.";
  actions.className = "cart-actions";
  reviewButton.type = "button";
  reviewButton.textContent = "Review cart in Swiggy";
  reviewButton.addEventListener("click", () => chrome.tabs.create({ url: INSTAMART_URL }));
  summary.textContent = "View returned cart details";
  cart.textContent = JSON.stringify(result.cart || {}, null, 2);

  details.append(summary, cart);
  actions.appendChild(reviewButton);
  section.append(title, message, actions, details);
  resultsElement.appendChild(section);
}

function formatProductChoice(choice) {
  const parts = [choice.productName];

  if (choice.brand) {
    parts.push(choice.brand);
  }
  if (choice.packSize) {
    parts.push(choice.packSize);
  }
  if (choice.price !== null && choice.price !== undefined) {
    parts.push(`Price ${choice.price}`);
  }
  if (choice.similar) {
    parts.push("Similar item");
  }

  return parts.join(" - ");
}

function getCheckedIngredients(list, recipe, normalizedIngredients) {
  return Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => {
    const index = Number(checkbox.dataset.index);
    const original = recipe.ingredients[index];
    return normalizedIngredients?.[index] || {
      original,
      item: original,
      quantity: null,
      unit: null,
      grocery_search_term: original
    };
  });
}

async function swiggyFetch(path, options = {}) {
  const session = await getSwiggySession();

  if (!session) {
    setSwiggyConnection(false, "Swiggy not connected");
    throw new Error("Connect Swiggy to continue.");
  }

  const response = await fetch(`${SWIGGY_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `RecipeBasket ${session}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    await clearSwiggySession();
    setSwiggyConnection(false, "Reconnect Swiggy");
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Swiggy could not complete this request.");
  }

  return result;
}

async function getSwiggySession() {
  const result = await chrome.runtime.sendMessage({ type: "getSwiggySession" });

  if (!result?.success) {
    throw new Error(result?.message || "Reload Recipe Basket Builder and try again.");
  }

  return result.session || "";
}

async function clearSwiggySession() {
  const result = await chrome.runtime.sendMessage({ type: "clearSwiggySession" });

  if (!result?.success) {
    throw new Error(result?.message || "Reload Recipe Basket Builder and try again.");
  }
}

function setAllCheckboxes(container, isChecked) {
  container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
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
  resultsElement.append(title, rawText);
}

function setStatus(message) {
  statusElement.textContent = message;
}

function setLoading(isLoading) {
  extractButton.disabled = isLoading;
  extractButton.textContent = isLoading ? "Extracting..." : "Extract Ingredients";
}
