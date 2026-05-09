import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      email: string;
      roles: string[];
      permissions: string[];
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    username: string;
    roles: string[];
    permissions: string[];
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 小時
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials.password) return null;
        const username = credentials.username.trim();
        const ip = (req?.headers?.["x-forwarded-for"] as string) || "";

        // 登入失敗限制：近 15 分鐘該帳號失敗 >= 5 次則拒絕
        const since = new Date(Date.now() - 15 * 60 * 1000);
        const recentFails = await prisma.loginLog.count({
          where: { username, success: false, createdAt: { gte: since } },
        });
        if (recentFails >= 5) {
          await prisma.loginLog.create({
            data: { username, success: false, ip, userAgent: req?.headers?.["user-agent"] as string },
          });
          throw new Error("登入失敗次數過多，請 15 分鐘後再試");
        }

        const user = await prisma.user.findUnique({
          where: { username },
          include: {
            userRoles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        });
        if (!user || !user.isActive) {
          await prisma.loginLog.create({ data: { username, success: false, ip } });
          return null;
        }

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) {
          await prisma.loginLog.create({ data: { userId: user.id, username, success: false, ip } });
          return null;
        }

        const roles = (user.userRoles as any[]).map((ur) => ur.role.name);
        const permsSet = new Set<string>();
        let isSuper = false;
        for (const ur of user.userRoles as any[]) {
          if (ur.role.name === "系統管理員") isSuper = true;
          for (const rp of ur.role.permissions as any[]) permsSet.add(rp.permission.code);
        }
        const permissions = isSuper ? ["*"] : Array.from(permsSet);

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastLoginIp: ip },
        });
        await prisma.loginLog.create({ data: { userId: user.id, username, success: true, ip } });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          roles,
          permissions,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.uid = u.id;
        token.username = u.username;
        token.roles = u.roles;
        token.permissions = u.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid,
        username: token.username,
        name: session.user?.name ?? "",
        email: session.user?.email ?? "",
        roles: token.roles ?? [],
        permissions: token.permissions ?? [],
      };
      return session;
    },
  },
};

export function hasPermission(perms: string[] | undefined, code: string) {
  if (!perms || perms.length === 0) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(code)) return true;
  // module.manage 視為該模組所有動作
  const [mod] = code.split(".");
  return perms.includes(`${mod}.manage`);
}
