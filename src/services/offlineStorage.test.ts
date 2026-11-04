import test from "node:test";
import assert from "node:assert/strict";
import { hashPin, offlineStorage } from "./offlineStorage.ts";
import type { Product } from "../types/api.ts";

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

test("saving products with images and embeddings preserves them in catalog storage", () => {
  const dummyProducts: Product[] = [
    {
      id: "prod-storage-1",
      name: "Product with images",
      category_id: "cat-1",
      images: [
        {
          id: "img-1",
          product_id: "prod-storage-1",
          image_url: "https://example.com/item.jpg",
          is_primary: true,
          embedding: [0.12, 0.34, 0.56],
          embedding_model: "clip-vit-base",
        },
      ],
    },
  ];

  offlineStorage.saveCatalog(dummyProducts, []);
  const catalog = offlineStorage.getCatalog();
  assert.strictEqual(catalog.products.length, 1);
  assert.deepStrictEqual(catalog.products[0].images, dummyProducts[0].images);
});

test("getAllProductEmbeddings extracts embeddings from active products and caches result", () => {
  const dummyProducts: Product[] = [
    {
      id: "prod-1",
      name: "Product 1",
      category_id: "cat-1",
      is_active: true,
      images: [
        {
          id: "img-1",
          product_id: "prod-1",
          image_url: "https://example.com/1.jpg",
          embedding: [0.1, 0.2, 0.3],
          embedding_model: "clip-vit-base",
        },
        {
          id: "img-2",
          product_id: "prod-1",
          image_url: "https://example.com/2.jpg",
          embedding: [0.4, 0.5, 0.6],
        },
      ],
    },
    {
      id: "prod-2",
      name: "Product 2 (inactive)",
      category_id: "cat-1",
      is_active: false,
      images: [
        {
          id: "img-3",
          product_id: "prod-2",
          image_url: "https://example.com/3.jpg",
          embedding: [0.7, 0.8, 0.9],
        },
      ],
    },
    {
      id: "prod-3",
      name: "Product 3 (no embeddings)",
      category_id: "cat-1",
      is_active: true,
      images: [
        {
          id: "img-4",
          product_id: "prod-3",
          image_url: "https://example.com/4.jpg",
          embedding: [],
        },
        {
          id: "img-5",
          product_id: "prod-3",
          image_url: "https://example.com/5.jpg",
        },
      ],
    },
    {
      id: "prod-4",
      name: "Product 4 (no images property)",
      category_id: "cat-1",
    },
  ];

  offlineStorage.saveCatalog(dummyProducts, []);

  const embeddings = offlineStorage.getAllProductEmbeddings();
  assert.strictEqual(embeddings.length, 2);
  assert.deepStrictEqual(embeddings[0], {
    productId: "prod-1",
    imageId: "img-1",
    embedding: [0.1, 0.2, 0.3],
  });
  assert.deepStrictEqual(embeddings[1], {
    productId: "prod-1",
    imageId: "img-2",
    embedding: [0.4, 0.5, 0.6],
  });

  // Verify caching: subsequent call returns identical reference
  const secondCall = offlineStorage.getAllProductEmbeddings();
  assert.strictEqual(secondCall, embeddings);
});

test("getAllProductEmbeddings invalidates cache when catalog is updated or explicitly invalidated", () => {
  const initialProducts: Product[] = [
    {
      id: "prod-1",
      name: "Product 1",
      category_id: "cat-1",
      is_active: true,
      images: [
        {
          id: "img-1",
          product_id: "prod-1",
          image_url: "https://example.com/1.jpg",
          embedding: [0.1, 0.2],
        },
      ],
    },
  ];

  offlineStorage.saveCatalog(initialProducts, []);
  const initialEmbeddings = offlineStorage.getAllProductEmbeddings();
  assert.strictEqual(initialEmbeddings.length, 1);

  // Explicit cache invalidation
  offlineStorage.invalidateEmbeddingsCache();
  const recalculated = offlineStorage.getAllProductEmbeddings();
  assert.strictEqual(recalculated.length, 1);
  assert.notStrictEqual(recalculated, initialEmbeddings);

  // Update catalog with an additional product embedding
  const updatedProducts: Product[] = [
    ...initialProducts,
    {
      id: "prod-2",
      name: "Product 2",
      category_id: "cat-1",
      is_active: true,
      images: [
        {
          id: "img-2",
          product_id: "prod-2",
          image_url: "https://example.com/2.jpg",
          embedding: [0.8, 0.9],
        },
      ],
    },
  ];

  offlineStorage.saveCatalog(updatedProducts, []);
  const updatedEmbeddings = offlineStorage.getAllProductEmbeddings();
  assert.strictEqual(updatedEmbeddings.length, 2);
  assert.notStrictEqual(updatedEmbeddings, recalculated);
});
