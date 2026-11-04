import test from "node:test";
import assert from "node:assert/strict";
import {
  l2Normalize,
  cosineSimilarity,
  matchQueryVector,
  type CatalogItemEmbedding,
} from "./visualMatch.ts";

test("l2Normalize: normalizes vectors to unit length", () => {
  const vec = [3, 4];
  const normalized = l2Normalize(vec);
  assert.equal(normalized.length, 2);
  assert.ok(Math.abs(normalized[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(normalized[1] - 0.8) < 1e-6);

  const norm = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
  assert.ok(Math.abs(norm - 1.0) < 1e-6);
});

test("l2Normalize: handles zero vector and empty array gracefully without NaN", () => {
  assert.deepEqual(l2Normalize([]), []);

  const zeros = [0, 0, 0];
  const normalizedZeros = l2Normalize(zeros);
  assert.deepEqual(normalizedZeros, [0, 0, 0]);
  assert.ok(!normalizedZeros.some((v) => Number.isNaN(v)));
});

test("l2Normalize: keeps unit vector intact and handles negative components", () => {
  const unit = [0, -1, 0];
  const normalized = l2Normalize(unit);
  assert.deepEqual(normalized, [0, -1, 0]);
});

test("cosineSimilarity: calculates correct cosine similarity", () => {
  // Identical vectors = 1.0
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1.0) < 1e-6);

  // Orthogonal vectors = 0.0
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);

  // Opposite vectors = -1.0
  assert.ok(Math.abs(cosineSimilarity([1, 0], [-1, 0]) - -1.0) < 1e-6);

  // Known 45-degree angle cos(pi/4) ≈ 0.7071
  const sim = cosineSimilarity([1, 0], [1, 1]);
  assert.ok(Math.abs(sim - Math.SQRT1_2) < 1e-4);
});

test("cosineSimilarity: returns 0 for zero vectors, empty arrays, or mismatched lengths", () => {
  assert.equal(cosineSimilarity([], []), 0);
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
  assert.equal(cosineSimilarity([1, 2, 3], [0, 0, 0]), 0);
});

test("cosineSimilarity: clamps output strictly to [-1.0, 1.0]", () => {
  // Even with floating precision inaccuracies
  const val = cosineSimilarity([1.0000000001, 0], [1.0, 0]);
  assert.ok(val <= 1.0 && val >= -1.0);
});

test("matchQueryVector: returns NO_MATCH with null bestMatch when catalog is empty", () => {
  const result = matchQueryVector([1, 0, 0], []);
  assert.equal(result.tier, "NO_MATCH");
  assert.equal(result.bestMatch, null);
  assert.deepEqual(result.candidates, []);
});

test("matchQueryVector: returns NO_MATCH when query is zero vector", () => {
  const catalog: CatalogItemEmbedding[] = [
    { productId: "p1", embedding: [1, 0, 0] },
  ];
  const result = matchQueryVector([0, 0, 0], catalog);
  assert.equal(result.tier, "NO_MATCH");
  assert.equal(result.bestMatch, null);
});

test("matchQueryVector: returns HIGH_CONFIDENCE for clear exact match (score >= 0.85)", () => {
  const catalog: CatalogItemEmbedding[] = [
    { productId: "product-ice-1", imageId: "img-1", embedding: [1, 0, 0] },
    { productId: "product-snack-2", imageId: "img-2", embedding: [0, 1, 0] },
  ];

  const result = matchQueryVector([1, 0, 0], catalog);

  assert.equal(result.tier, "HIGH_CONFIDENCE");
  assert.ok(result.bestMatch !== null);
  assert.equal(result.bestMatch?.productId, "product-ice-1");
  assert.equal(result.bestMatch?.imageId, "img-1");
  assert.ok(Math.abs(result.bestMatch!.score - 1.0) < 1e-6);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].productId, "product-ice-1");
  assert.equal(result.candidates[1].productId, "product-snack-2");
});

test("matchQueryVector: returns NO_MATCH when best match score is below lowThreshold (< 0.70)", () => {
  // Vector at angle > 45 deg where cosine similarity is < 0.70 (e.g. [1, 0.4] vs [0, 1] dot product is 0.4 / norm)
  const catalog: CatalogItemEmbedding[] = [
    { productId: "product-1", embedding: [0.3, 0.95] },
  ];

  // query: [1, 0] -> cosine similarity with [0.3, 0.95] is ~0.30 (< 0.70)
  const result = matchQueryVector([1, 0], catalog);

  assert.equal(result.tier, "NO_MATCH");
  assert.equal(result.bestMatch, null);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].productId, "product-1");
  assert.ok(result.candidates[0].score < 0.7);
});

test("matchQueryVector: returns AMBIGUOUS when score is between lowThreshold and highThreshold (0.70 - 0.84)", () => {
  // Query [1, 0], target [0.75, 0.66] (norm ~ 1, dot ~ 0.75)
  const target = l2Normalize([0.75, 0.66]);
  const catalog: CatalogItemEmbedding[] = [
    { productId: "product-drink-1", embedding: target },
  ];

  const result = matchQueryVector([1, 0], catalog);

  assert.equal(result.tier, "AMBIGUOUS");
  assert.ok(result.bestMatch !== null);
  assert.equal(result.bestMatch?.productId, "product-drink-1");
  assert.ok(result.bestMatch!.score >= 0.7 && result.bestMatch!.score < 0.85);
});

test("matchQueryVector: returns AMBIGUOUS when top 2 candidates have close scores (< ambiguityMargin)", () => {
  // Query is [1, 0, 0]
  // Product A has score ~ 0.90
  // Product B has score ~ 0.88
  // Difference is 0.02, which is < default ambiguityMargin (0.05)
  const embA = l2Normalize([0.9, 0.435, 0]);
  const embB = l2Normalize([0.88, 0.474, 0]);

  const catalog: CatalogItemEmbedding[] = [
    { productId: "product-pepsi", embedding: embA },
    { productId: "product-coke", embedding: embB },
  ];

  const result = matchQueryVector([1, 0, 0], catalog);

  assert.equal(result.tier, "AMBIGUOUS");
  assert.ok(result.bestMatch !== null);
  assert.equal(result.bestMatch?.productId, "product-pepsi");
  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates[0].score >= 0.85);
  assert.ok(result.candidates[1].score >= 0.7);
  assert.ok(result.candidates[0].score - result.candidates[1].score < 0.05);
});

test("matchQueryVector: returns HIGH_CONFIDENCE when top score >= 0.85 and runner-up is far enough (> ambiguityMargin)", () => {
  const embA = l2Normalize([0.95, 0.31, 0]); // score ~ 0.95
  const embB = l2Normalize([0.85, 0.52, 0]); // score ~ 0.85 (diff ~ 0.10 > 0.05)

  const catalog: CatalogItemEmbedding[] = [
    { productId: "product-pepsi", embedding: embA },
    { productId: "product-coke", embedding: embB },
  ];

  const result = matchQueryVector([1, 0, 0], catalog);

  assert.equal(result.tier, "HIGH_CONFIDENCE");
  assert.equal(result.bestMatch?.productId, "product-pepsi");
});

test("matchQueryVector: deduplicates multiple embeddings of the same product, keeping highest score", () => {
  const catalog: CatalogItemEmbedding[] = [
    {
      productId: "product-chips",
      imageId: "angle-1",
      embedding: l2Normalize([0.7, 0.71, 0]),
    }, // ~0.70
    {
      productId: "product-chips",
      imageId: "angle-2",
      embedding: l2Normalize([0.95, 0.31, 0]),
    }, // ~0.95
    {
      productId: "product-chips",
      imageId: "angle-3",
      embedding: l2Normalize([0.8, 0.6, 0]),
    }, // ~0.80
    {
      productId: "product-water",
      imageId: "angle-w",
      embedding: l2Normalize([0.82, 0.57, 0]),
    }, // ~0.82
  ];

  const result = matchQueryVector([1, 0, 0], catalog);

  assert.equal(result.tier, "HIGH_CONFIDENCE");
  assert.equal(result.candidates.length, 2); // only 2 unique products
  assert.equal(result.candidates[0].productId, "product-chips");
  assert.equal(result.candidates[0].imageId, "angle-2");
  assert.ok(result.candidates[0].score > 0.94);
  assert.equal(result.candidates[1].productId, "product-water");
});

test("matchQueryVector: respects custom MatchOptions (thresholds and topK)", () => {
  const catalog: CatalogItemEmbedding[] = [
    { productId: "p1", embedding: [1, 0, 0] },
    { productId: "p2", embedding: [0.9, 0.43, 0] },
    { productId: "p3", embedding: [0.8, 0.6, 0] },
    { productId: "p4", embedding: [0.7, 0.71, 0] },
  ];

  const result = matchQueryVector([1, 0, 0], catalog, {
    highThreshold: 0.95,
    lowThreshold: 0.85,
    topK: 2,
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].productId, "p1");
  assert.equal(result.candidates[1].productId, "p2");
});
