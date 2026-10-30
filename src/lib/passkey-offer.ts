// The passkey offer of the studio app (#26): the choice of Nina on this device, in `localStorage`.
export const PASSKEY_KEY = "tumach.passkey";

/** "added": this device has a passkey; "notNow": Nina said "Not now". The app asks only when neither. */
export type PasskeyChoice = "added" | "notNow";

export function passkeyChoice(storage: Pick<Storage, "getItem">): PasskeyChoice | null {
  const value = storage.getItem(PASSKEY_KEY);
  return value === "added" || value === "notNow" ? value : null;
}

export function savePasskeyChoice(storage: Pick<Storage, "setItem">, choice: PasskeyChoice): void {
  storage.setItem(PASSKEY_KEY, choice);
}
