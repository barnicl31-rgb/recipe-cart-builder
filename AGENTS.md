# Swiggy Builders Club

When writing code against Swiggy MCP (Food, Instamart, Dineout), consult the authoritative docs before recommending or implementing tool names, parameters, error handling, rate limits, or auth flows.

- Index: https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per-page Markdown: append `.md` to any `https://mcp.swiggy.com/builders/docs/...` URL

Tool schemas live under `/docs/reference/{food,instamart,dineout}`.
Error codes live at `/docs/reference/errors`.
Auth flow is at `/docs/start/authenticate`.

Rules:

1. Before recommending a Swiggy tool name, parameter, error code, rate limit, or auth flow, fetch the relevant doc and verify it.
2. Never invent Swiggy tool names or parameters. If the docs do not cover it, say so and ask.
3. Prefer `.md` page fetches over `llms-full.txt` when the exact area is known.
4. For Recipe Basket Builder, prefer Instamart docs and tools unless the request is explicitly about Food or Dineout.
5. Treat checkout/order placement as sensitive. Require clear user confirmation before implementing or invoking any flow that could place an order.

Smoke test:

- Fetch `https://mcp.swiggy.com/builders/llms.txt`.
- Confirm the Food MCP server exposes 14 tools.
