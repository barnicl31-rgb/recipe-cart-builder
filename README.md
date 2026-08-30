# Recipe Basket Builder

Recipe Basket Builder is an MVP Chrome extension and local backend for converting online recipe ingredients into grocery-ready search terms and preparing them for Swiggy Instamart basket creation via MCP/API integration.

## Files

- `manifest.json` - Chrome extension configuration.
- `popup.html` - Popup UI.
- `popup.js` - Popup behavior, checklist controls, and Swiggy basket review.
- `background.js` - persistent Chrome identity handoff and encrypted session storage for Swiggy authentication.
- `content.js` - Page scanner for JSON-LD recipe data or selected text.
- `styles.css` - Popup styling.
- `server.js` - Local API for ingredient normalization and learning.
- `lib/swiggyMcp.js` - authenticated Swiggy Instamart MCP client using the official SDK.
- `lib/groceryQuery.js` - production recipe-text cleanup, keyword fallbacks, and product relevance ranking.
- `api/swiggy/` - production OAuth, product search, and cart endpoints deployed on Vercel.

## Load the Extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn Developer Mode on.
4. Click Load unpacked.
5. Select this project folder.
6. Open a recipe website.
7. Click the extension icon.
8. Click Extract Ingredients.

## Run the Backend

Start the local API:

```bash
npm start
```

If `npm` is not available, run:

```powershell
& "C:\Users\finan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

Ingredient normalization continues to run locally. Live Swiggy access uses the production OAuth flow, so the extension never needs a manually copied Swiggy token.

For optional local MCP debugging, create a local environment with:

```text
SWIGGY_MCP_ENDPOINT=https://mcp.swiggy.com/im
SWIGGY_TOKEN=<your Swiggy OAuth access token>
```

You can copy `.env.example` as a starting point. Do not commit real Swiggy tokens.

The extension sends extracted ingredients to:

```text
http://localhost:3000/api/normalize-ingredients
```

The backend cleans recipe text, maps ingredients to grocery-friendly search terms, and checks a local learning store before using the built-in grocery catalog.

Example:

```json
[
  {
    "original": "1 teaspoon kosher salt",
    "item": "salt",
    "quantity": 1,
    "unit": "teaspoon",
    "grocery_search_term": "salt"
  }
]
```

## Learning Admin

Keyword mappings are managed in a separate backend admin page so the extension popup stays clean for end users.

Open this while the backend is running:

```text
http://localhost:3000/admin/learning
```

Add an ingredient phrase and the grocery search term you want the system to use. The backend saves corrections locally to:

```text
learning-store.json
```

Future extractions check this file first, so repeated mappings improve matching over time.

Example:

```text
"500 g lamb mince ((ground lamb, or beef))" -> "lamb mince"
```

`learning-store.json` is ignored by Git because it is local learning data.

## Swiggy MCP Flow

Click **Connect** in the extension and complete Swiggy phone-and-OTP authentication. Chrome's identity flow returns the production callback result directly to the extension, where an encrypted session envelope is saved; the raw Swiggy access token is never placed in extension storage.

The live basket journey is:

```text
get_addresses -> choose address -> search_products -> choose variants -> update_cart -> get_cart
```

Search results are shown before any cart mutation. Recipe measurements and preparation notes are removed before search, and the best matching available variation is selected initially; price is used as a tie-breaker. The user can change or skip every ingredient. Clicking **Add selected products** replaces the Instamart cart with the reviewed selections and sends Swiggy's live `spinId` and `skuId` for each variation.

The extension does not call `checkout`. Swiggy's checkout docs require explicit user confirmation after displaying the cart, address, bill details, and available payment methods.

The official grocery order journey is:

```text
get_addresses -> search_products -> update_cart -> get_cart -> checkout
```

## Demo Flow

1. Open a recipe website.
2. Click the extension.
3. Extract ingredients.
4. Select the ingredients you want.
5. Connect Swiggy if this browser has not been connected yet.
6. Click Build Basket and review the delivery address and product variants.
7. Click Add selected products.
8. The extension opens one Instamart tab so you can review the live cart and make any final changes before checkout.

## Production Environment

Set these values in Vercel before deploying:

```text
SWIGGY_MCP_ENDPOINT=https://mcp.swiggy.com/im
SWIGGY_REDIRECT_URI=https://recipe-basket-builder.vercel.app/auth/callback
SWIGGY_SESSION_SECRET=<random value containing at least 32 characters>
```

After deploying an extension update, reload it from `chrome://extensions` so the new `storage` permission and production host permission are active.

If the backend maps an ingredient incorrectly, open `http://localhost:3000/admin/learning` and add the preferred keyword there.

## License

Copyright (c) 2026. All rights reserved.

This project is shared publicly for review and demonstration purposes only. You may not copy, modify, distribute, or use this code without explicit written permission.
