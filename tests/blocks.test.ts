// The times that Nina keeps free (#323).
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBlock, listBlocks, removeBlock } from "../src/db/blocks";

const HOUR = 60 * 60 * 1000;
const T = Date.UTC(2026, 10, 10, 9, 0);

test("a block shows in an overlapping period, not before or after it", () => {
  const db = openDb(":memory:");
  const block = addBlock(db, { start: T, end: T + 2 * HOUR }, T);
  expect(block.createdAt).toBe(T);
  expect(listBlocks(db, T + HOUR, T + 3 * HOUR).map((b) => b.id)).toEqual([block.id]);
  expect(listBlocks(db, T - 3 * HOUR, T).map((b) => b.id)).toEqual([]);
  expect(listBlocks(db, T + 2 * HOUR, T + 4 * HOUR).map((b) => b.id)).toEqual([]);
});

test("the blocks of a period come by start", () => {
  const db = openDb(":memory:");
  const late = addBlock(db, { start: T + HOUR, end: T + 2 * HOUR });
  const early = addBlock(db, { start: T, end: T + HOUR });
  expect(listBlocks(db, T, T + 3 * HOUR).map((b) => b.id)).toEqual([early.id, late.id]);
});

test("a block with an end that is not after its start is refused", () => {
  const db = openDb(":memory:");
  expect(() => addBlock(db, { start: T, end: T })).toThrow(RangeError);
  expect(() => addBlock(db, { start: T, end: T - HOUR })).toThrow(RangeError);
  expect(listBlocks(db, 0, Number.MAX_SAFE_INTEGER)).toEqual([]);
});

test("removeBlock removes the block and returns it; the second time it returns undefined", () => {
  const db = openDb(":memory:");
  const block = addBlock(db, { start: T, end: T + HOUR });
  expect(removeBlock(db, block.id)?.id).toBe(block.id);
  expect(removeBlock(db, block.id)).toBeUndefined();
  expect(listBlocks(db, 0, Number.MAX_SAFE_INTEGER)).toEqual([]);
});
