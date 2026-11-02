import test from "node:test";
import assert from "node:assert/strict";
import { satangToBaht, bahtToSatang, formatBaht } from "./currency.ts";

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
