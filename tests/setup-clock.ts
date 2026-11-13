// The clock of each unit test is fixed: 20 October 2026, 12:00 in Amsterdam (the `NOW` of the booking tests).
// The tests use fixed dates. With the real clock a test starts to fail on the day that its dates are in the past:
// the booking tests failed on `main` from 7 November 2026. A test that needs another time gives `now` to the
// function, or calls `vi.setSystemTime()`. Only `Date` is fixed: the timers run as usual.
import { afterEach, beforeEach, vi } from "vitest";

export const TEST_NOW = Date.UTC(2026, 9, 20, 10, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: TEST_NOW });
});

afterEach(() => {
  vi.useRealTimers();
});
