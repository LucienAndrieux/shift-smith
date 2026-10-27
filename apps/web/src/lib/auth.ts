import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env, isAdminEmail } from "@/lib/env";
import { appUrl, sendEmail } from "@/server/email";

/**
 * Better Auth: email + password. New accounts are `viewer` / `pending` until an admin
 * approves them, except addresses listed in ADMIN_EMAIL which become approved admins.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: {
    database: { generateId: "uuid" },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password — ShiftSmith",
        text: `Hello ${user.name},\n\nUse this link to choose a new password:\n${url}\n\nIf you did not ask for this, ignore this email.`,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: ["admin", "viewer"],
        required: false,
        defaultValue: "viewer",
        input: false,
      },
      accessStatus: {
        type: ["pending", "approved", "rejected"],
        required: false,
        defaultValue: "pending",
        input: false,
      },
      approvedAt: { type: "date", required: false, input: false },
      approvedBy: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAdminEmail(user.email)) {
            return {
              data: { ...user, role: "viewer", accessStatus: "pending" },
            };
          }
          return {
            data: {
              ...user,
              role: "admin",
              accessStatus: "approved",
              approvedAt: new Date(),
            },
          };
        },
        after: async (user) => {
          if (isAdminEmail(user.email)) return;
          await sendEmail({
            to: env().ADMIN_EMAIL,
            subject: `New access request: ${user.name}`,
            text: `${user.name} <${user.email}> registered and is waiting for approval.\n\nReview the request: ${appUrl("/admin/users")}`,
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
