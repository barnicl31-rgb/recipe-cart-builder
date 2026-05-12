(() => {
  const statusId = "recipe-basket-builder-swiggy-status";

  runAutomation();

  async function runAutomation() {
    const { recipeBasketBuilderTerms = [] } = await chrome.storage.local.get("recipeBasketBuilderTerms");
    const searchTerms = Array.from(new Set(recipeBasketBuilderTerms.filter(Boolean)));

    if (searchTerms.length === 0) {
      return;
    }

    showStatus(`Preparing to add ${searchTerms.length} item(s).`);

    for (const searchTerm of searchTerms) {
      showStatus(`Searching for ${searchTerm}...`);
      await searchForItem(searchTerm);
      await wait(2400);

      const addButton = findBestAddButton();

      if (!addButton) {
        showStatus(`Could not find an Add button for ${searchTerm}. Continuing...`);
        await wait(1200);
        continue;
      }

      addButton.click();
      showStatus(`Clicked Add for ${searchTerm}.`);
      await wait(1600);
      await chooseFirstVariantIfShown();
    }

    showStatus("Finished. Review the Swiggy basket before checkout.");
  }

  async function searchForItem(searchTerm) {
    const searchInput = await waitForElement(() => findSearchInput(), 6000);

    if (!searchInput) {
      window.location.href = `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(searchTerm)}`;
      return;
    }

    searchInput.focus();
    searchInput.value = "";
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    await wait(200);
    searchInput.value = searchTerm;
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: searchTerm }));
    searchInput.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter" }));
    searchInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", code: "Enter" }));
  }

  function findSearchInput() {
    const inputs = Array.from(document.querySelectorAll("input"));

    return inputs.find((input) => {
      const text = `${input.placeholder || ""} ${input.ariaLabel || ""}`.toLowerCase();
      return text.includes("search");
    }) || inputs[0];
  }

  function findBestAddButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));

    return buttons.find((button) => {
      const text = button.innerText.trim().toLowerCase();
      const box = button.getBoundingClientRect();

      return text === "add" && box.width > 0 && box.height > 0;
    });
  }

  async function chooseFirstVariantIfShown() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
    const addButtons = buttons.filter((button) => button.innerText.trim().toLowerCase() === "add");

    if (addButtons.length <= 1) {
      return;
    }

    addButtons
      .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)[0]
      .click();
    await wait(1000);
  }

  function showStatus(message) {
    let status = document.getElementById(statusId);

    if (!status) {
      status = document.createElement("div");
      status.id = statusId;
      status.style.position = "fixed";
      status.style.right = "16px";
      status.style.bottom = "16px";
      status.style.zIndex = "2147483647";
      status.style.maxWidth = "320px";
      status.style.padding = "12px 14px";
      status.style.borderRadius = "12px";
      status.style.background = "#173f35";
      status.style.color = "white";
      status.style.font = "13px Arial, sans-serif";
      status.style.boxShadow = "0 10px 26px rgba(0, 0, 0, 0.24)";
      document.body.appendChild(status);
    }

    status.textContent = `Recipe Basket Builder: ${message}`;
  }

  function waitForElement(findElement, timeoutMs) {
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        const element = findElement();

        if (element) {
          clearInterval(timer);
          resolve(element);
          return;
        }

        if (Date.now() - startedAt > timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 250);
    });
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
})();
