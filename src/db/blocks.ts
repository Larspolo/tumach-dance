// The times that Nina keeps free of bookings (#323, epic #322). `start` and `end` are UTC, epoch milliseconds.
import { and, asc, eq, gt, lt } from "drizzle-orm";
import type { Db } from "./index";
import { blocks } from "./schema";

export type Block = typeof blocks.$inferSelect;
export type NewBlock = { start: number; end: number };

/** Keep a time free: refuse an `end` that is not after `start`. */
export function addBlock(db: Db, { start, end }: NewBlock, now: number = Date.now()): Block {
  if (!(end > start)) {
    throw new RangeError(`block end must be after start: ${start}-${end}`);
  }
  return db.insert(blocks).values({ start, end, createdAt: now }).returning().get();
}

/** The blocks that overlap `from`..`to` (`start < to` and `end > from`), by `start`. */
export function listBlocks(db: Db, from: number, to: number): Block[] {
  return db
    .select()
    .from(blocks)
    .where(and(lt(blocks.start, to), gt(blocks.end, from)))
    .orderBy(asc(blocks.start), asc(blocks.id))
    .all();
}

/** Delete a block and return it; `undefined` when no block has that id. */
export function removeBlock(db: Db, id: number): Block | undefined {
  return db.delete(blocks).where(eq(blocks.id, id)).returning().get();
}
