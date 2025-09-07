import { expect, test } from 'vitest';
import { add } from "./main.ts";

test(function addTest() {
  expect(add(2, 3)).to.equal(5);
});
