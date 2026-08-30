const test = require("node:test");
const assert = require("node:assert/strict");

const { extractProductChoices } = require("../lib/swiggyMcp");

test("Swiggy product variations retain live SKU identifiers and nested prices", () => {
  const choices = extractProductChoices({
    success: true,
    data: {
      products: [{
        displayName: "Extra Virgin Olive Oil",
        brand: "Choice",
        inStock: true,
        isAvail: true,
        productId: "product-1",
        parentProductId: "parent-1",
        variations: [
          {
            spinId: "spin-1",
            skuId: "sku-1",
            quantityDescription: "500 ml",
            price: { mrp: 400, offerPrice: 350 },
            isInStockAndAvailable: true,
            imageUrl: "https://example.com/oil.jpg",
            maxQuantity: 4
          },
          {
            spinId: "spin-2",
            skuId: "sku-2",
            quantityDescription: "1 L",
            price: { mrp: 700, offerPrice: 650 },
            isInStockAndAvailable: false
          }
        ]
      }]
    }
  });

  assert.equal(choices.products.length, 1);
  assert.equal(choices.products[0].spinId, "spin-1");
  assert.equal(choices.products[0].skuId, "sku-1");
  assert.equal(choices.products[0].productId, "product-1");
  assert.equal(choices.products[0].price, 350);
  assert.equal(choices.products[0].maxQuantity, 4);
});
