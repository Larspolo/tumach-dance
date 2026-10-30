# Learnings

The agent writes here what it learned the hard way. Each line must save time in a later session.

## Environment and libraries

- `npm --version` 10 (Node 22 of the image, before the hook fix of #16): npm 10 drops the `libc` fields of `package-lock.json`. Install with `npx -y npm@11 install --save-exact`.

## Code

- Luxon: `DateTime.set({ hour })` takes the first instant of a local time that exists twice (end of summer time), `DateTime.fromISO()` the second. `src/lib/hours.ts` uses `set()`.
