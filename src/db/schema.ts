// The database schema (#14). Drizzle Kit makes the migrations in `drizzle/` from this file: `npm run db:generate`.
// Times: each instant is an integer of epoch milliseconds in UTC (as `OpenRange` of `src/lib/hours.ts`), one form
// for all tables. The site shows it in Europe/Amsterdam time.
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
