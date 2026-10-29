import {
  type AnyPgColumn,
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Better Auth tables (user, session, account, verification), matching the output of
 * `pnpm dlx auth@latest generate --adapter drizzle --dialect pg`, plus the access
 * fields declared as `user.additionalFields` in `src/lib/auth.ts`.
 */

/**
 * `manager`, `employee` and `viewer` (read-only) are the visitor roles; `admin` and
 * `demo` come from earlier versions and are read as `manager`.
 */
export const userRole = pgEnum("user_role", [
  "admin",
  "demo",
  "viewer",
  "manager",
  "employee",
]);
export const accessStatus = pgEnum("access_status", [
  "pending",
  "approved",
  "rejected",
]);

export const user = pgTable(
  "user",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: userRole().notNull().default("viewer"),
    accessStatus: accessStatus().notNull().default("pending"),
    approvedAt: timestamp({ withTimezone: true }),
    approvedBy: uuid().references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    /** Guest of the public demo (Better Auth anonymous plugin). */
    isAnonymous: boolean().notNull().default(false),
    /**
     * The fictional employee an `employee` guest plays. No foreign key: the demo
     * restore re-creates the employees (and removes the guests).
     */
    employeeId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.accessStatus),
    index().on(t.approvedBy),
    index().on(t.isAnonymous, t.createdAt),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.identifier)],
);
