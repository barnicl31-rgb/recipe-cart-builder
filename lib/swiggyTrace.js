const { createHash, randomUUID } = require("node:crypto");

const TRACKED_ARRAYS = new Set([
  "products",
  "similarProducts",
  "variations",
  "variants"
]);

function createSwiggyTrace(addressId) {
  return {
    traceId: randomUUID(),
    addressRef: createHash("sha256")
      .update(String(addressId || ""))
      .digest("hex")
      .slice(0, 12)
  };
}

function summarizeProductResult(result) {
  const data = result?.data ?? result;

  return {
    success: result?.success !== false,
    topLevelKeys: objectKeys(result),
    dataKeys: objectKeys(data),
    arrayCounts: collectTrackedArrays(data),
    hasMessage: Boolean(
      result?.message ||
      result?.error?.message ||
      data?.message ||
      data?.error?.message
    )
  };
}

function summarizeSwiggyError(error) {
  return {
    errorName: String(error?.name || "Error"),
    errorStatus: Number.isFinite(Number(error?.status)) ? Number(error.status) : null,
    errorCode: typeof error?.code === "string" || typeof error?.code === "number"
      ? String(error.code)
      : null,
    hasMessage: Boolean(error?.message)
  };
}

function logSwiggyTrace(level, event, trace, details = {}) {
  const logger = console[level] || console.info;

  logger(JSON.stringify({
    source: "recipe-basket-builder",
    event,
    traceId: trace?.traceId || "unavailable",
    addressRef: trace?.addressRef || "unavailable",
    ...details
  }));
}

function collectTrackedArrays(value) {
  const counts = new Map();
  const visited = new WeakSet();

  walk(value, "data", 0);

  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));

  function walk(current, path, depth) {
    if (!current || typeof current !== "object" || depth > 6 || visited.has(current)) {
      return;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.slice(0, 20).forEach((item) => walk(item, `${path}[]`, depth + 1));
      return;
    }

    for (const [key, nested] of Object.entries(current)) {
      const nestedPath = `${path}.${key}`;

      if (Array.isArray(nested) && TRACKED_ARRAYS.has(key)) {
        counts.set(nestedPath, (counts.get(nestedPath) || 0) + nested.length);
      }

      walk(nested, nestedPath, depth + 1);
    }
  }
}

function objectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
}

module.exports = {
  createSwiggyTrace,
  logSwiggyTrace,
  summarizeProductResult,
  summarizeSwiggyError
};
