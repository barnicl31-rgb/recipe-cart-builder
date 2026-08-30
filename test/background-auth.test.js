const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const backgroundSource = fs.readFileSync(require.resolve("../background.js"), "utf8");

test("the background auth flow saves the returned Swiggy session", async () => {
  const extensionId = "a".repeat(32);
  const harness = createBackgroundHarness(
    extensionId,
    `https://${extensionId}.chromiumapp.org/swiggy#session=sealed-session`
  );

  const response = await harness.connect();

  assert.equal(response.success, true);
  assert.equal(harness.getStoredValue().swiggySession, "sealed-session");
});

test("the background auth flow rejects an unexpected return address", async () => {
  const harness = createBackgroundHarness(
    "a".repeat(32),
    "https://example.com/swiggy#session=sealed-session"
  );

  const response = await harness.connect();

  assert.equal(response.success, false);
  assert.equal(harness.getStoredValue(), undefined);
});

function createBackgroundHarness(extensionId, finalUrl) {
  let messageListener;
  let storedValue;
  const context = vm.createContext({
    URL,
    URLSearchParams,
    encodeURIComponent,
    console: { error() {} },
    chrome: {
      runtime: {
        id: extensionId,
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          }
        }
      },
      identity: {
        getRedirectURL(path) {
          return `https://${extensionId}.chromiumapp.org/${path}`;
        },
        async launchWebAuthFlow() {
          return finalUrl;
        }
      },
      storage: {
        local: {
          async set(value) {
            storedValue = value;
          }
        }
      }
    }
  });

  vm.runInContext(backgroundSource, context);

  return {
    connect() {
      return new Promise((resolve) => {
        const staysOpen = messageListener({ type: "connectSwiggy" }, {}, resolve);
        assert.equal(staysOpen, true);
      });
    },
    getStoredValue() {
      return storedValue;
    }
  };
}
