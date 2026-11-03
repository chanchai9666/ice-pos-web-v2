import test from "node:test";
import assert from "node:assert/strict";
import { hashPin, offlineStorage } from "./offlineStorage.ts";

test("hashPin generates deterministic hex string for given pin", async () => {
  const hash1 = await hashPin("1234");
  const hash2 = await hashPin("1234");
  const hashOther = await hashPin("5678");

  assert.strictEqual(typeof hash1, "string");
  assert.ok(hash1.length > 0);
  assert.strictEqual(hash1, hash2);
  assert.notStrictEqual(hash1, hashOther);
});

test("offlineStorage returns initial empty structures gracefully in Node environment", () => {
  const catalog = offlineStorage.getCatalog();
  assert.deepStrictEqual(catalog.products, []);
  assert.deepStrictEqual(catalog.categories, []);

  const customers = offlineStorage.getCustomers();
  assert.deepStrictEqual(customers, []);

  const sales = offlineStorage.getOfflineSales();
  assert.deepStrictEqual(sales, []);
});
