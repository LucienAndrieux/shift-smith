import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

/**
 * Better Auth, anonymous sessions only: the start page creates a guest and
 * `enterDemo()` sets its role (manager, employee or read-only). There are no
 * accounts, passwords or emails.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: {
    database: { generateId: "uuid" },
  },
  emailAndPassword: { enabled: false },
  user: {
    additionalFields: {
      role: {
        type: ["admin", "demo", "viewer", "manager", "employee"],
        required: false,
        defaultValue: "viewer",
        input: false,
      },
      accessStatus: {
        type: ["pending", "approved", "rejected"],
        required: false,
        defaultValue: "approved",
        input: false,
      },
      employeeId: { type: "string", required: false, input: false },
    },
  },
  plugins: [
    anonymous({
      emailDomainName: "guest.invalid",
      generateName: () => "Guest",
      disableDeleteAnonymousUser: true,
    }),
    // Must stay last: sets the cookies of auth calls made from Server Actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
