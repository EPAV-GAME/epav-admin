import test from 'node:test';
import assert from 'node:assert/strict';
import { productImageUrl } from '../js/product-photo.mjs';

const photo = 'https://epav-swift-images.kevinernandes2012.workers.dev/images/swift/' + 'a'.repeat(64) + '.webp';
test('accepts stored Swift image URLs and missing images', () => {
  assert.equal(productImageUrl({ imagemSwift: { url: photo } }), photo);
  for (const product of [null, {}, { imagemSwift: {} }]) assert.equal(productImageUrl(product), null);
});
test('rejects external hosts, unsafe schemes and non-image routes', () => {
  for (const url of [photo.replace('https:', 'http:'), photo.replace('.workers.dev', '.workers.dev.example.com'), photo.replace('/images/swift/', '/admin/'), photo + '?token=private', photo.replace('https://', 'https://user:password@'), 'javascript:alert(1)', 'not a URL']) {
    assert.equal(productImageUrl({ imagemSwift: { url } }), null);
  }
});
