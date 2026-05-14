import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { buildLoginIdentifierCandidates } from "@/lib/identity";

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
        email: {
          label: "Email",
          type: "email",
          placeholder: "user@example.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const identifier = credentials?.email;
        const password = credentials?.password;

        if (typeof identifier !== "string" || typeof password !== "string") {
          throw new Error("Invalid credentials");
        }

        const emailCandidates = buildLoginIdentifierCandidates(identifier);

        if (!emailCandidates.length) {
          throw new Error("Invalid credentials");
        }

        // Find user in database
        const user = await db.user.findFirst({
          where: {
            email: {
              in: emailCandidates,
            },
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
          throw new Error("User not found");
        }

        if (!user.isActive) {
          throw new Error("Account is inactive");
        }

        // Verify password
        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

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
  secret: process.env.AUTH_SECRET || "development_secret_only_for_orcs",
} satisfies NextAuthConfig;


export const { auth, handlers, signIn, signOut } = NextAuth(authOptions);
