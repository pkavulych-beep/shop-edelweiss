import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./DishForm.tsx', import.meta.url), 'utf8');

test('dish form fills the dialog width on phones', () => {
  assert.match(
    source,
    /<Form autoComplete="off" style=\{\{ width: '100%', maxWidth: 600, padding: 14, boxSizing: 'border-box' \}\}>/,
    'DishForm width must be 100%, capped at 600 on larger screens',
  );
});
