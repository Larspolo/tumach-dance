// Make the placeholder icons of the studio app (public/icons/) until Nina gives a logo.
// Run: node scripts/make-icons.ts
import { readFile, writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og.js";

const font = await readFile("node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff");
const rust = "#a8503a";
const cream = "#f4efe6";

async function icon(file: string, size: number, letter: number) {
  const image = new ImageResponse(
    {
      type: "div",
      key: null,
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: rust,
          color: cream,
          fontFamily: "Fraunces",
          fontSize: size * letter,
        },
        children: "T",
      },
    },
    { width: size, height: size, fonts: [{ name: "Fraunces", data: font, weight: 600 }] },
  );
  await writeFile(`public/icons/${file}`, Buffer.from(await image.arrayBuffer()));
}

await icon("icon-192.png", 192, 0.6);
await icon("icon-512.png", 512, 0.6);
// The safe zone of a maskable icon is the inner 80 %: a smaller letter.
await icon("icon-maskable-512.png", 512, 0.42);
await icon("apple-touch-icon.png", 180, 0.6);
