import { expect, test } from "vitest";
import { robotsRules } from "../src/lib/site-robots";

test("the preview blocks all search engines", () => {
  expect(robotsRules("preview", "https://preview.tumach.dance")).toEqual({
    rules: { userAgent: "*", disallow: "/" },
  });
});

test("the live site hides the studio, the API and each cancel link, and names the sitemap", () => {
  const robots = robotsRules("live", "https://tumach.dance");
  expect(robots.rules).toEqual({
    userAgent: "*",
    allow: "/",
    disallow: ["/studio", "/api", "/en/booking/cancel", "/nl/booking/cancel", "/sl/booking/cancel"],
  });
  expect(robots.sitemap).toBe("https://tumach.dance/sitemap.xml");
});
