// A time that Nina keeps free, from the form of the week page (#327): a local date and times to UTC instants.
import { addBlock, type Block } from "../db/blocks";
import type { Db } from "../db/index";
import { localInstant } from "./hours";

export type LocalBlock = { date: string; from: string; to: string };

/** Store the block of a local date, from and to (Europe/Amsterdam). A wrong date or time, or an end not after the start: a RangeError and nothing stored. */
export function addLocalBlock(db: Db, { date, from, to }: LocalBlock, now: number = Date.now()): Block {
  return addBlock(db, { start: localInstant(date, from), end: localInstant(date, to) }, now);
}
