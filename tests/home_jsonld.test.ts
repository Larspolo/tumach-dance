// The structured data of the home page: the studio and one `sameAs` link per account (#452).
import { expect, test } from "vitest";
import { nonceFrom } from "../src/lib/csp";
import { jsonLdText, studioJsonLd } from "../src/lib/home-jsonld";

const ORIGIN = "https://tumach.dance";

test("the data has the type, the name, the url of the locale and one sameAs link per account", () => {
  const env = { ...process.env, STUDIO_INSTAGRAM: "@tumach.dance", STUDIO_WHATSAPP: "+31 6 12345678" };
  const data = studioJsonLd("nl", ORIGIN, env);
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@type"]).toBe("DanceSchool");
  expect(data.name).toBe("TUMACH");
  expect(data.url).toBe("https://tumach.dance/nl");
  expect(data.sameAs).toEqual(["https://www.instagram.com/tumach.dance/", "https://wa.me/31612345678"]);
});

test("with no account there is no sameAs", () => {
  const data = studioJsonLd("en", ORIGIN, { ...process.env, STUDIO_INSTAGRAM: "", STUDIO_WHATSAPP: "" });
  expect(data).not.toHaveProperty("sameAs");
  expect(data.url).toBe("https://tumach.dance/en");
});

test("the JSON text cannot close the script tag", () => {
  const text = jsonLdText({ name: "</script><script>alert(1)</script>" });
  expect(text).not.toContain("<");
  expect(JSON.parse(text).name).toBe("</script><script>alert(1)</script>");
});

test("the nonce of a policy is read back for the script", () => {
  expect(nonceFrom("script-src 'self' 'nonce-abc+/=' 'strict-dynamic'")).toBe("abc+/=");
  expect(nonceFrom("default-src 'self'")).toBeUndefined();
  expect(nonceFrom(null)).toBeUndefined();
});
