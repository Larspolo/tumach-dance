// The parts of the guide for Nina (#45, #776): one list for the page and the tests of epic #774. Each part names the
// studio page that it explains, a title key and up to 3 step keys of `StudioGuide` in `messages/`. A step with an
// image shows the picture `public/guide/<locale>/<image>.png` (`e2e/guide-screenshots.spec.ts`).
export type GuideStep = { key: string; image?: string };
// `also`: other studio pages that the part explains too (the page "For Nina" is `questions` and `feedback`, #779).
export type GuidePart = { id: string; page: string; also?: string[]; title: string; steps: GuideStep[] };

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
  {
    id: "repeat",
    page: "/studio/week",
    title: "repeatTitle",
    steps: [{ key: "repeatOpen" }, { key: "repeatChoose" }, { key: "repeatSave" }],
  },
  {
    id: "sick",
    page: "/studio/week",
    title: "sickTitle",
    steps: [{ key: "sickOpen" }, { key: "sickYes" }],
  },
  {
    id: "holiday",
    page: "/studio/hours",
    title: "holidayTitle",
    steps: [{ key: "holidayClose" }, { key: "holidayList" }, { key: "holidayCancel" }],
  },
  {
    id: "fix",
    page: "/studio/week",
    title: "fixTitle",
    steps: [{ key: "fixOpen" }, { key: "fixSave" }, { key: "historyOpen" }],
  },
  {
    id: "forget",
    page: "/studio/week",
    title: "forgetTitle",
    steps: [{ key: "forgetOpen" }, { key: "forgetYes" }],
  },
  {
    id: "money",
    page: "/studio/money",
    title: "moneyTitle",
    steps: [{ key: "moneyOpen" }, { key: "moneyPaid" }, { key: "moneyYear" }],
  },
  {
    id: "search",
    page: "/studio/search",
    title: "searchTitle",
    steps: [{ key: "searchOpen" }, { key: "searchType" }],
  },
  {
    id: "note",
    page: "/studio/dancer/[id]",
    title: "noteTitle",
    steps: [{ key: "noteOpen" }, { key: "noteSave" }],
  },
  {
    id: "whatsapp",
    page: "/studio/bookings",
    title: "whatsappTitle",
    steps: [{ key: "whatsappOpen" }, { key: "whatsappSend" }],
  },
  {
    id: "share",
    page: "/studio/offers",
    title: "shareTitle",
    steps: [{ key: "shareOpen" }, { key: "shareSend" }],
  },
  {
    id: "hours",
    page: "/studio/hours",
    title: "hoursTitle",
    steps: [{ key: "hoursOpen" }, { key: "hoursSet" }, { key: "hoursSave" }],
  },
  {
    id: "offers",
    page: "/studio/offers",
    title: "offersTitle",
    steps: [{ key: "offersOpen" }, { key: "offersChange" }, { key: "offersAdd" }],
  },
  {
    id: "classes",
    page: "/studio/classes",
    title: "classesTitle",
    steps: [{ key: "classesOpen" }, { key: "classesAdd" }, { key: "classesTime" }],
  },
  {
    id: "news",
    page: "/studio/news",
    title: "newsTitle",
    steps: [{ key: "newsOpen" }, { key: "newsSave" }, { key: "newsRemove" }],
  },
  {
    id: "photos",
    page: "/studio/photos",
    title: "photosTitle",
    steps: [{ key: "photosOpen" }, { key: "photosAdd" }, { key: "photosRemove" }],
  },
  {
    id: "messages",
    page: "/studio/messages",
    title: "messagesTitle",
    steps: [{ key: "messagesOpen" }, { key: "messagesSend" }],
  },
  {
    id: "devices",
    page: "/studio/devices",
    title: "devicesTitle",
    steps: [{ key: "devicesOpen" }, { key: "devicesLogOut" }],
  },
  {
    id: "nina",
    page: "/studio/questions",
    also: ["/studio/feedback"],
    title: "ninaTitle",
    steps: [{ key: "ninaQuestions" }, { key: "ninaFeedback" }],
  },
];
