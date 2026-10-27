import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env, isAdminEmail } from "@/lib/env";
import { appUrl, sendEmail } from "@/server/email";

const demoMode = process.env.DEMO_MODE === "true";

/**
 * Better Auth: email + password. New accounts are `viewer` / `pending` until an admin
 * approves them, except addresses listed in ADMIN_EMAIL which become approved admins.
 * In demo mode, visitors enter as anonymous guests (see src/server/demo) and only
 * ADMIN_EMAIL addresses may register.
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
        type: ["admin", "demo", "viewer"],
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
          if ((user as { isAnonymous?: boolean }).isAnonymous) {
            // Guests start read-only; enterDemo() upgrades managers to `demo`.
            return {
              data: {
                ...user,
                role: "viewer",
                accessStatus: "approved",
                approvedAt: new Date(),
              },
            };
          }
          if (demoMode && !isAdminEmail(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed on the demo.",
            });
          }
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
          if ((user as { isAnonymous?: boolean }).isAnonymous) return;
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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/anonymous" && !demoMode) {
        throw new APIError("NOT_FOUND");
      }
    }),
  },
  plugins: [
    // Guest access of the public demo; the endpoint is refused outside demo mode.
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
