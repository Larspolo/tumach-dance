// The database schema (#14). Drizzle Kit makes the migrations in `drizzle/` from this file: `npm run db:generate`.
// Times: each instant is an integer of epoch milliseconds in UTC (as `OpenRange` of `src/lib/hours.ts`), one form
// for all tables. The site shows it in Europe/Amsterdam time.
import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The settings of the site: one row per key, the value as JSON text. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  /** UTC, epoch milliseconds. */
  updatedAt: integer("updated_at").notNull(),
});

// The login of the studio app (#19): the core tables of Better Auth (`src/lib/auth.ts`), with the field names of its
// Drizzle adapter. The times are Drizzle `timestamp_ms`: the same epoch milliseconds, read as a `Date`.

/** The one user: Nina (`STUDIO_EMAIL`). */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** A login on one device. The cookie holds the token. */
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

/** A way to log in (Better Auth needs the table; the code by email adds no row). */
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

/** A code by email that waits for its check: the hash of the code and the count of tries. */
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** A passkey of Nina on one device (#26): the passkey plugin of Better Auth (SimpleWebAuthn) checks it. */
export const passkey = sqliteTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    transports: text("transports"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    aaguid: text("aaguid"),
  },
  (table) => [index("passkey_user_id_idx").on(table.userId), index("passkey_credential_id_idx").on(table.credentialID)],
);

/** The offers of the studio (#30). The name that dancers see comes from `messages/` by `kind` and `minutes`. */
export const offers = sqliteTable(
  "offers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["lesson", "rental"] }).notNull(),
    minutes: integer("minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    /** The order on the page: low first. */
    position: integer("position").notNull(),
  },
  (t) => [
    check("offers_kind", sql`${t.kind} IN ('lesson', 'rental')`),
    check("offers_minutes", sql`${t.minutes} > 0`),
    check("offers_price", sql`${t.priceCents} >= 0`),
  ],
);

/** A device of Nina that gets push notifications (#25). A device that subscribes again replaces its row. */
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  /** UTC, epoch milliseconds. */
  createdAt: integer("created_at").notNull(),
  /** The language of the studio app on the device (#69): the push texts of a timer have no request. */
  locale: text("locale").notNull().default("en"),
});

/** A question for Nina (a GitHub issue) that has had its push (#69). The row comes before the push: one push only. */
export const notifiedQuestions = sqliteTable("notified_questions", {
  number: integer("number").primaryKey(),
  /** UTC, epoch milliseconds. */
  notifiedAt: integer("notified_at").notNull(),
});

/**
 * The example data of a question for Nina that the preview loaded (#146). The row comes before the seed: two taps,
 * two devices or a restart load a seed once for one question.
 */
export const loadedExamples = sqliteTable(
  "loaded_examples",
  {
    question: integer("question").notNull(),
    name: text("name").notNull(),
    /** UTC, epoch milliseconds. */
    loadedAt: integer("loaded_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.question, t.name] })],
);

/** A booking request of a dancer (#34). A `requested` or `approved` booking holds its time: no other may overlap it. */
export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    offerId: integer("offer_id")
      .notNull()
      .references(() => offers.id),
    /** UTC, epoch milliseconds; `end` is exclusive. */
    start: integer("start").notNull(),
    end: integer("end").notNull(),
    status: text("status", { enum: ["requested", "approved", "declined", "cancelled"] })
      .notNull()
      .default("requested"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    /** The language of the dancer, for the emails. */
    locale: text("locale").notNull(),
    /** UTC, epoch milliseconds. */
    createdAt: integer("created_at").notNull(),
    /** UTC, epoch milliseconds; `null` = not paid. A paid booking stays `approved`. */
    paidAt: integer("paid_at"),
    /** UTC, epoch milliseconds; `null` = no reminder email yet (#165). Set before the send: one reminder only. */
    remindedAt: integer("reminded_at"),
  },
  (t) => [
    index("bookings_start_idx").on(t.start),
    check("bookings_status", sql`${t.status} IN ('requested', 'approved', 'declined', 'cancelled')`),
    check("bookings_range", sql`${t.end} > ${t.start}`),
  ],
);

/**
 * A class of the studio (#95). `name`, `text` and `forWhom` are JSON texts of the form `{"en": "...", "nl": "...",
 * "sl": "..."}`: `en` is required, the other languages are optional (`src/lib/local-text.ts`).
 */
export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  text: text("text").notNull(),
  forWhom: text("for_whom").notNull(),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  /** The order on the page: low first. */
  position: integer("position").notNull(),
});

/** A weekly time of a class (#95): a local wall time in Europe/Amsterdam, as the hours rule, not an instant. */
export const classTimes = sqliteTable(
  "class_times",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    weekday: text("weekday", { enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] }).notNull(),
    /** "HH:MM", local time. */
    from: text("from").notNull(),
    /** "HH:MM", local time, after `from`. */
    to: text("to").notNull(),
  },
  (t) => [index("class_times_class_id_idx").on(t.classId), check("class_times_range", sql`${t.to} > ${t.from}`)],
);

/**
 * A photo of the studio (#171). The files are in `PHOTOS_DIR` (`src/db/photos.ts`): `<file>-large.webp` and
 * `<file>-small.webp`. `width` and `height` are the size of the large version.
 */
export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** The base name of the files: random, so that nobody can guess it. */
  file: text("file").notNull().unique(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  /** The order on the page: low first. */
  position: integer("position").notNull(),
  /** UTC, epoch milliseconds. */
  createdAt: integer("created_at").notNull(),
});
