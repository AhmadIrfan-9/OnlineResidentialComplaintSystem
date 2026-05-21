import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { buildLoginIdentifierCandidates } from "@/lib/identity";

// Brute-force login protection: track failed attempts per identifier.
// After LOGIN_MAX_ATTEMPTS failures within LOGIN_WINDOW_MS, reject further attempts.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const loginAttempts      = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(key);
  }
}, 60_000);

function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(identifier);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function isLockedOut(identifier: string): boolean {
  const entry = loginAttempts.get(identifier);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) { loginAttempts.delete(identifier); return false; }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

interface ExtendedUser {
  id: string;
  role: string;
  hostelId: string | null;
  mustChangePassword: boolean;
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: {
          label: "Email or Student ID",
          type: "text",
          placeholder: "Email or Student ID",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier;
        const password = credentials?.password;

        if (typeof identifier !== "string" || typeof password !== "string") {
          throw new Error("Invalid credentials or password");
        }

        if (isLockedOut(identifier)) {
          throw new Error("Too many failed attempts. Please wait 15 minutes before trying again.");
        }

        const emailCandidates = buildLoginIdentifierCandidates(identifier);

        if (!emailCandidates.length) {
          throw new Error("Invalid credentials or password");
        }

        // Find user in database
        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: { in: emailCandidates } },
              { studentProfile: { studentId: identifier } },
            ],
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
          },
        });

        if (!user) {
          recordFailedAttempt(identifier);
          throw new Error("Invalid credentials or password");
        }

        if (!user.isActive) {
          throw new Error("Account is inactive");
        }

        // Verify password
        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
          recordFailedAttempt(identifier);
          throw new Error("Invalid credentials or password");
        }

        // Successful auth — clear the attempt counter
        loginAttempts.delete(identifier);

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await db.auditLog.create({
          data: {
            userId: user.id,
            userName: user.name,
            action: "Login",
            resource: "Auth",
            after: "Session created",
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hostelId: null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: sessionUpdate }) {
      if (trigger === "update" && sessionUpdate) {
        if (sessionUpdate.name) token.name = sessionUpdate.name;
      }
      if (user) {
        const u = user as unknown as ExtendedUser;
        token.id = u.id;
        token.role = u.role;
        token.hostelId = u.hostelId;
        token.mustChangePassword = u.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.hostelId = token.hostelId as string | null;
        if (token.name) session.user.name = token.name as string;
        (session.user as unknown as ExtendedUser).mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: (() => {
    const s = process.env.AUTH_SECRET;
    if (!s) throw new Error("AUTH_SECRET environment variable is not set. Set it before starting the server.");
    return s;
  })(),
} satisfies NextAuthConfig;


export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);
