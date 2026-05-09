import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission } from "./auth";
import { prisma } from "./prisma";

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) throw new ApiError(401, "未登入");
  return session;
}

export async function requirePermission(code: string) {
  const session = await requireAuth();
  if (!hasPermission(session.user.permissions, code)) {
    throw new ApiError(403, `權限不足: 需要 ${code}`);
  }
  return session;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (e: any) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error("[API Error]", e);
      return NextResponse.json({ error: e?.message ?? "伺服器錯誤" }, { status: 500 });
    }
  };
}

export async function audit(opts: {
  userId?: string | null;
  action: string;
  module: string;
  refId?: string;
  detail?: string;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({ data: { ...opts } });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}

// 編號產生器
export async function nextNumber(key: string) {
  return await prisma.$transaction(async (tx: any) => {
    const seq = await tx.numberSequence.upsert({
      where: { key },
      update: {},
      create: { key, prefix: key, nextNo: 1 },
    });
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const seqStr = String(seq.nextNo).padStart(4, "0");
    const number = (seq.format || "{prefix}{yyyy}{mm}-{seq:0000}")
      .replace("{prefix}", seq.prefix)
      .replace("{yyyy}", yyyy)
      .replace("{mm}", mm)
      .replace("{seq:0000}", seqStr);
    await tx.numberSequence.update({ where: { key }, data: { nextNo: seq.nextNo + 1 } });
    return number;
  });
}
