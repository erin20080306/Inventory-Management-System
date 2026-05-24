import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requirePermission, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// 還原時的清空順序 (反向: 從子到父，避免外鍵衝突)
const TRUNCATE_ORDER = [
  "auditLog", "loginLog",
  "fixedAsset",
  "attendanceRecord",
  "payrollItem", "payroll", "payrollPeriod",
  "employee", "department",
  "notePayable", "noteReceivable",
  "invoiceItem", "invoice",
  "supplierPayment", "accountsPayable",
  "receivePayment", "accountsReceivable",
  "journalEntryLine", "journalEntry",
  "purchaseReturnItem", "purchaseReturn",
  "salesReturnItem", "salesReturn",
  "stockTransferItem", "stockTransfer",
  "stockAdjustmentItem", "stockAdjustment",
  "inventoryTransaction", "inventoryStock",
  "quotationItem", "quotation",
  "salesOrderItem", "salesOrder",
  "purchaseOrderItem", "purchaseOrder",
  "bankTransaction", "cashTransaction",
  "bankAccount", "cashAccount",
  "supplier", "customer",
  "product", "productUnit", "productCategory",
  "warehouse", "chartOfAccount", "taxRate",
  "numberSequence", "systemSetting", "companySetting",
  "userRole", "user",
  "rolePermission", "role", "permission",
];

const RESTORE_ORDER = [...TRUNCATE_ORDER].reverse();

// 將 base64 字符串寫入圖片文件
async function writeImageFromBase64(filename: string, base64: string): Promise<void> {
  try {
    const uploadDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    const filepath = join(uploadDir, filename);
    const buffer = Buffer.from(base64, "base64");
    await writeFile(filepath, buffer);
  } catch (e) {
    console.error("還原圖片時出錯:", e);
  }
}

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await requirePermission("settings.manage");
  const body = await req.json();
  if (!body.tables || typeof body.tables !== "object") throw new Error("備份檔格式錯誤");

  // 還原邏輯：先清空 → 再依序匯入 → 還原圖片
  const counts: Record<string, number> = {};
  let imageCount = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const t of TRUNCATE_ORDER) {
        try {
          // @ts-ignore
          await (tx as any)[t].deleteMany();
        } catch {}
      }
      for (const t of RESTORE_ORDER) {
        const rows = body.tables[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        try {
          // @ts-ignore
          const r = await (tx as any)[t].createMany({ data: rows, skipDuplicates: true });
          counts[t] = r.count ?? rows.length;
        } catch (e: any) {
          counts[t] = -1;
        }
      }
    },
    { maxWait: 30000, timeout: 120000 }
  );

  // 還原圖片文件（在事務外進行，避免影響資料庫還原）
  if (body.images && typeof body.images === "object") {
    for (const [filename, base64] of Object.entries(body.images)) {
      if (typeof base64 === "string") {
        await writeImageFromBase64(filename, base64);
        imageCount++;
      }
    }
  }

  await audit({ userId: session.user.id, action: "restore_backup", module: "settings" });
  return NextResponse.json({ ok: true, counts, imageCount });
});
