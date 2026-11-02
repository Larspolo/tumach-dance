// The kind of a device and its browser from the User-Agent of a login session (#585). A few regexes are enough: the
// page of the devices only names a device for Nina, so a parser library would add weight and give no more use.

export type DeviceType = "phone" | "tablet" | "computer" | "unknown";
export type Browser = "safari" | "chrome" | "firefox" | "edge" | "unknown";

export function deviceKind(userAgent: string | null): { type: DeviceType; browser: Browser } {
  if (!userAgent) return { type: "unknown", browser: "unknown" };
  const ua = userAgent;
  let type: DeviceType = "unknown";
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) type = "tablet";
  else if (/iPhone|iPod|Android.*Mobile|Mobile/.test(ua)) type = "phone";
  else if (/Windows NT|Macintosh|Mac OS X|X11|Linux|CrOS/.test(ua)) type = "computer";
  let browser: Browser = "unknown";
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = "edge";
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = "firefox";
  else if (/Chrome\/|CriOS\//.test(ua)) browser = "chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "safari";
  return { type, browser };
}
