// The form of the "Hours" page (#23) to the weekly rule and back. P1: two groups, not a grid of seven days.
import type { DayHours, HoursRule, Weekday } from "./hours";
import { checkHoursRule } from "./hours-store";

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
export const WEEKEND: Weekday[] = ["sat", "sun"];

export type GroupMode = "closed" | "allDay" | "from";
export type Group = { mode: GroupMode; from: string };
/** The choices of the form. `days`: the weekdays that are open (one tap removes a day). */
export type HoursForm = { weekdays: Group & { days: Weekday[] }; weekend: Group };

const DEFAULT_FROM = "17:00";

function groupOf(rule: HoursRule, days: Weekday[]): Group {
  const open = days.map((d) => rule.weekly[d]).filter((h): h is Exclude<DayHours, "closed"> => !!h && h !== "closed");
  const first = open[0];
  if (!first) return { mode: "closed", from: DEFAULT_FROM };
  if (first === "allDay") return { mode: "allDay", from: DEFAULT_FROM };
  return { mode: "from", from: first.from };
}

/** The form that shows a stored rule. */
export function ruleToForm(rule: HoursRule): HoursForm {
  const days = WEEKDAYS.filter((d) => rule.weekly[d] && rule.weekly[d] !== "closed");
  return {
    weekdays: { ...groupOf(rule, WEEKDAYS), days: days.length ? days : [...WEEKDAYS] },
    weekend: groupOf(rule, WEEKEND),
  };
}

function hoursOf(group: Group): DayHours {
  if (group.mode === "allDay") return "allDay";
  if (group.mode === "from") return { from: group.from };
  return "closed";
}

/** The rule of the form; it keeps `day`, `closed` and `extraOpen` of the stored rule. A wrong form throws a `RangeError`. */
export function formToRule(form: HoursForm, stored: HoursRule): HoursRule {
  const weekly: HoursRule["weekly"] = {};
  const weekdays = hoursOf(form.weekdays);
  for (const d of form.weekdays.days) if (weekdays !== "closed") weekly[d] = weekdays;
  const weekend = hoursOf(form.weekend);
  for (const d of WEEKEND) if (weekend !== "closed") weekly[d] = weekend;
  const rule = { ...stored, weekly };
  checkHoursRule(rule);
  return rule;
}

function group(data: FormData, name: string): Group {
  const mode = String(data.get(`${name}Mode`));
  if (mode !== "closed" && mode !== "allDay" && mode !== "from") throw new RangeError(`Not a mode: ${mode}`);
  return { mode, from: String(data.get(`${name}From`) ?? "") };
}

/** The choices of a posted form. */
export function readHoursForm(data: FormData): HoursForm {
  const days = WEEKDAYS.filter((d) => data.get(`day-${d}`) === "on");
  return { weekdays: { ...group(data, "weekdays"), days }, weekend: group(data, "weekend") };
}
