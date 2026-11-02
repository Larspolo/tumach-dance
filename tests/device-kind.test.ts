import { describe, expect, it } from "vitest";
import { deviceKind } from "@/lib/device-kind";

describe("deviceKind", () => {
  it.each([
    [
      "iPhone with Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      { type: "phone", browser: "safari" },
    ],
    [
      "Android phone with Chrome",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      { type: "phone", browser: "chrome" },
    ],
    [
      "iPad",
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      { type: "tablet", browser: "safari" },
    ],
    [
      "Mac with Firefox",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0",
      { type: "computer", browser: "firefox" },
    ],
    [
      "Windows with Edge",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
      { type: "computer", browser: "edge" },
    ],
    ["null", null, { type: "unknown", browser: "unknown" }],
    ["an unknown string", "curl/8.5.0", { type: "unknown", browser: "unknown" }],
  ])("%s", (_name, ua, expected) => {
    expect(deviceKind(ua)).toEqual(expected);
  });
});
