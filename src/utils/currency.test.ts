import test from "node:test";
import assert from "node:assert/strict";
import {
  satangToBaht,
  bahtToSatang,
  formatBaht,
  getSmartCashSuggestions,
} from "./currency.ts";

test("satangToBaht converts satang integer to baht correctly", () => {
  assert.equal(satangToBaht(5000), 50);
  assert.equal(satangToBaht(150), 1.5);
  assert.equal(satangToBaht(0), 0);
});

test("bahtToSatang converts baht float/int to satang integer safely", () => {
  assert.equal(bahtToSatang(50), 5000);
  assert.equal(bahtToSatang(50.5), 5050);
  assert.equal(bahtToSatang(19.99), 1999);
  assert.equal(bahtToSatang(0.01), 1);
});

test("formatBaht formats currency string with 2 decimal places and baht sign", () => {
  assert.equal(formatBaht(5000), "50.00 ฿");
  assert.equal(formatBaht(5050), "50.50 ฿");
  assert.equal(formatBaht(0), "0.00 ฿");
});

test("getSmartCashSuggestions generates correct suggestions for small amount (3 Baht)", () => {
  const suggestions = getSmartCashSuggestions(3);
  assert.deepEqual(suggestions, [5, 10, 20, 50, 100, 500, 1000]);
});

test("getSmartCashSuggestions generates correct suggestions for 55 Baht", () => {
  const suggestions = getSmartCashSuggestions(55);
  assert.deepEqual(suggestions, [60, 100, 500, 1000]);
});

test("getSmartCashSuggestions generates correct suggestions for 1,240 Baht (including 1250 and 1260)", () => {
  const suggestions = getSmartCashSuggestions(1240);
  assert.deepEqual(suggestions, [1250, 1260, 1300, 1500, 2000]);
});

test("getSmartCashSuggestions generates correct suggestions for flat hundred amounts (100 Baht)", () => {
  const suggestions = getSmartCashSuggestions(100);
  assert.deepEqual(suggestions, [500, 1000]);
});

test("getSmartCashSuggestions returns empty array for zero or negative amounts", () => {
  assert.deepEqual(getSmartCashSuggestions(0), []);
  assert.deepEqual(getSmartCashSuggestions(-50), []);
});
