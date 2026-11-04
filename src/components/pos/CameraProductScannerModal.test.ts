import test from "node:test";
import assert from "node:assert/strict";
import type { Product } from "../../types/api.ts";
import type { MatchCandidate } from "../../services/visualMatch.ts";
import {
  shouldTriggerSound,
  getViewfinderBorderClass,
  getCandidatesWithProducts,
  formatConfidencePercent,
} from "./cameraScannerLogic.ts";

// Mock Product fixtures
const mockProductA: Product = {
  id: "prod-1",
  name: "น้ำดื่มตราสิงห์ 600ml",
  code: "SINGHA-600",
  barcode: "8850999001",
  unit_price: 1000, // 10.00 Baht
  price: 1000,
  category_id: "cat-drinks",
  is_active: true,
};

const mockProductB: Product = {
  id: "prod-2",
  name: "น้ำดื่มคริสตัล 600ml",
  code: "CRYSTAL-600",
  barcode: "8850999002",
  unit_price: 1000,
  price: 1000,
  category_id: "cat-drinks",
  is_active: true,
};

const mockProductC: Product = {
  id: "prod-3",
  name: "โค้ก ออริจินัล 325ml",
  code: "COKE-325",
  barcode: "8850999003",
  unit_price: 1500,
  price: 1500,
  category_id: "cat-drinks",
  is_active: true,
};

test("shouldTriggerSound: returns true on new HIGH_CONFIDENCE product match", () => {
  const trigger = shouldTriggerSound(
    "HIGH_CONFIDENCE",
    "prod-1",
    null,
    0,
    10000
  );
  assert.equal(trigger, true);
});

test("shouldTriggerSound: returns false on consecutive scans of same product within cooldown", () => {
  const lastAlertTime = 10000;
  const currentTime = 11000; // 1s later (< 3s cooldown)
  const trigger = shouldTriggerSound(
    "HIGH_CONFIDENCE",
    "prod-1",
    "prod-1",
    lastAlertTime,
    currentTime
  );
  assert.equal(trigger, false);
});

test("shouldTriggerSound: returns true on same product after cooldown window has expired", () => {
  const lastAlertTime = 10000;
  const currentTime = 13500; // 3.5s later (> 3s cooldown)
  const trigger = shouldTriggerSound(
    "HIGH_CONFIDENCE",
    "prod-1",
    "prod-1",
    lastAlertTime,
    currentTime
  );
  assert.equal(trigger, true);
});

test("shouldTriggerSound: returns true when switching to a different product immediately", () => {
  const lastAlertTime = 10000;
  const currentTime = 10500; // 0.5s later, but different product
  const trigger = shouldTriggerSound(
    "HIGH_CONFIDENCE",
    "prod-2",
    "prod-1",
    lastAlertTime,
    currentTime
  );
  assert.equal(trigger, true);
});

test("shouldTriggerSound: respects custom cooldownMs parameter", () => {
  const lastAlertTime = 10000;
  const currentTime = 11500; // 1.5s later
  // Default cooldown is 3000ms -> false
  assert.equal(
    shouldTriggerSound(
      "HIGH_CONFIDENCE",
      "prod-1",
      "prod-1",
      lastAlertTime,
      currentTime,
      3000
    ),
    false
  );
  // Custom cooldown is 1000ms -> true
  assert.equal(
    shouldTriggerSound(
      "HIGH_CONFIDENCE",
      "prod-1",
      "prod-1",
      lastAlertTime,
      currentTime,
      1000
    ),
    true
  );
});

test("shouldTriggerSound: returns false for AMBIGUOUS and NO_MATCH tiers", () => {
  assert.equal(
    shouldTriggerSound("AMBIGUOUS", "prod-1", null, 0, 10000),
    false
  );
  assert.equal(shouldTriggerSound("NO_MATCH", "prod-1", null, 0, 10000), false);
  assert.equal(shouldTriggerSound(null, "prod-1", null, 0, 10000), false);
  assert.equal(shouldTriggerSound(undefined, "prod-1", null, 0, 10000), false);
  assert.equal(
    shouldTriggerSound("HIGH_CONFIDENCE", undefined, null, 0, 10000),
    false
  );
});

test("getViewfinderBorderClass: returns appropriate border classes per match tier", () => {
  const highClass = getViewfinderBorderClass("HIGH_CONFIDENCE");
  assert.match(highClass, /border-success/);
  assert.match(highClass, /shadow-/);

  const ambigClass = getViewfinderBorderClass("AMBIGUOUS");
  assert.match(ambigClass, /border-warning/);

  const noMatchClass = getViewfinderBorderClass("NO_MATCH");
  assert.match(noMatchClass, /border-primary/);

  const defaultClass = getViewfinderBorderClass(null);
  assert.match(defaultClass, /border-primary/);

  const undefClass = getViewfinderBorderClass(undefined);
  assert.match(undefClass, /border-primary/);
});

test("getCandidatesWithProducts: maps match candidates to products correctly", () => {
  const productsMap = new Map<string, Product>([
    [mockProductA.id, mockProductA],
    [mockProductB.id, mockProductB],
    [mockProductC.id, mockProductC],
  ]);

  const candidates: MatchCandidate[] = [
    { productId: "prod-1", score: 0.92 },
    { productId: "prod-2", score: 0.88 },
    { productId: "unknown-prod", score: 0.75 },
  ];

  const matched = getCandidatesWithProducts(candidates, productsMap);

  assert.equal(matched.length, 2);
  assert.equal(matched[0].product.name, "น้ำดื่มตราสิงห์ 600ml");
  assert.equal(matched[0].candidate.score, 0.92);
  assert.equal(matched[1].product.name, "น้ำดื่มคริสตัล 600ml");
  assert.equal(matched[1].candidate.score, 0.88);
});

test("getCandidatesWithProducts: returns empty array when candidates or productsMap is empty", () => {
  const emptyMap = new Map<string, Product>();
  const candidates: MatchCandidate[] = [{ productId: "prod-1", score: 0.92 }];
  assert.deepEqual(getCandidatesWithProducts(candidates, emptyMap), []);
  assert.deepEqual(
    getCandidatesWithProducts([], new Map([[mockProductA.id, mockProductA]])),
    []
  );
});

test("formatConfidencePercent: formats scores to percentage strings correctly", () => {
  assert.equal(formatConfidencePercent(0.954), "95%");
  assert.equal(formatConfidencePercent(0.8), "80%");
  assert.equal(formatConfidencePercent(1.0), "100%");
  assert.equal(formatConfidencePercent(0), "0%");
  assert.equal(formatConfidencePercent(undefined), "0%");
  assert.equal(formatConfidencePercent(-0.5), "0%");
  assert.equal(formatConfidencePercent(NaN), "0%");
});

test("product selection workflow: simulates cashier clicking candidate and invoking callback", () => {
  const selectedProducts: Product[] = [];
  const handleSelect = (p: Product) => {
    selectedProducts.push(p);
  };

  const productsMap = new Map<string, Product>([
    [mockProductA.id, mockProductA],
    [mockProductB.id, mockProductB],
  ]);

  const candidates: MatchCandidate[] = [
    { productId: "prod-1", score: 0.91 },
    { productId: "prod-2", score: 0.82 },
  ];

  const matched = getCandidatesWithProducts(candidates, productsMap);
  assert.equal(matched.length, 2);

  // Cashier taps the top match
  handleSelect(matched[0].product);
  assert.equal(selectedProducts.length, 1);
  assert.equal(selectedProducts[0].id, "prod-1");
  assert.equal(selectedProducts[0].name, "น้ำดื่มตราสิงห์ 600ml");

  // Cashier taps second candidate
  handleSelect(matched[1].product);
  assert.equal(selectedProducts.length, 2);
  assert.equal(selectedProducts[1].id, "prod-2");
});
