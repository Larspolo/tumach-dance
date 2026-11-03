// The parts of the guide for Nina (#45, #776): one list for the page and the tests of epic #774. Each part names the
// studio page that it explains, a title key and up to 3 step keys of `StudioGuide` in `messages/`. A step with an
// image shows the picture `public/guide/<locale>/<image>.png` (`e2e/guide-screenshots.spec.ts`).
export type GuideStep = { key: string; image?: string };
export type GuidePart = { id: string; page: string; title: string; steps: GuideStep[] };

export const GUIDE_PARTS: GuidePart[] = [
  {
    id: "login",
    page: "/studio/login",
    title: "loginTitle",
    steps: [
      { key: "loginOpen" },
      { key: "loginEmail", image: "login-email" },
      { key: "loginCode", image: "login-code" },
    ],
  },
  {
    id: "install",
    page: "/studio",
    title: "installTitle",
    steps: [{ key: "installIphone" }, { key: "installAndroid" }, { key: "installOpen" }],
  },
  {
    id: "notifications",
    page: "/studio",
    title: "pushTitle",
    steps: [{ key: "pushTurnOn", image: "push-off" }, { key: "pushAllow" }, { key: "pushTest", image: "push-on" }],
  },
  {
    id: "approve",
    page: "/studio/bookings",
    title: "approveTitle",
    steps: [{ key: "approvePush" }, { key: "approveTap" }, { key: "approveUndo" }],
  },
  {
    id: "add",
    page: "/studio/week",
    title: "addTitle",
    steps: [{ key: "addOpen" }, { key: "addChoose" }, { key: "addSave" }],
  },
  {
    id: "block",
    page: "/studio/week",
    title: "blockTitle",
    steps: [{ key: "blockOpen" }, { key: "blockSave" }, { key: "blockRemove" }],
  },
  {
    id: "move",
    page: "/studio/week",
    title: "moveTitle",
    steps: [{ key: "moveOpen" }, { key: "moveChoose" }, { key: "moveYes" }],
  },
];
