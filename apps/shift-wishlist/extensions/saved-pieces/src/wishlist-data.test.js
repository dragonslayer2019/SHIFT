import assert from 'node:assert/strict';
import test from 'node:test';

import {MAX_ITEMS, normalizeItems} from './wishlist-data.js';

test('normalizes, validates, and deduplicates product handles', () => {
  assert.deepEqual(
    normalizeItems(['the-little-horizon', ' the-little-horizon ', 'The Invalid Handle', null, 'the-pebble-pause']),
    ['the-little-horizon', 'the-pebble-pause'],
  );
});

test('limits persisted wishlist data to 100 handles', () => {
  const handles = Array.from({length: MAX_ITEMS + 5}, (_, index) => `piece-${index}`);
  assert.equal(normalizeItems(handles).length, MAX_ITEMS);
});

test('normalizes malformed metafield values to an empty wishlist', () => {
  assert.deepEqual(normalizeItems(null), []);
  assert.deepEqual(normalizeItems({items: ['the-little-horizon']}), []);
});
