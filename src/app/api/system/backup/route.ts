import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requirePermission, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// 備份順序：依外鍵相依性，匯出時不影響；還原時須依此順序匯入
const BACKUP_TABLES = [
  "permission", "role", "rolePermission", "user", "userRole",
  "companySetting", "systemSetting", "numberSequence", "taxRate",
  "chartOfAccount", "warehouse", "productCategory", "productUnit",
  "product", "customer", "supplier",
  "cashAccount", "bankAccount", "cashTransaction", "bankTransaction",
  "purchaseOrder", "purchaseOrderItem",
  "salesOrder", "salesOrderItem",
  "quotation", "quotationItem",
  "inventoryStock", "inventoryTransaction",
  "stockAdjustment", "stockAdjustmentItem",
  "stockTransfer", "stockTransferItem",
  "salesReturn", "salesReturnItem",
  "purchaseReturn", "purchaseReturnItem",
  "journalEntry", "journalEntryLine",
  "accountsReceivable", "receivePayment",
  "accountsPayable", "supplierPayment",
  "noteReceivable", "notePayable",
  "fixedAsset",
  "department", "employee",
  "payrollPeriod", "payroll", "payrollItem",
  "attendanceRecord",
  "invoice", "invoiceItem",
  "loginLog", "auditLog",
] as const;

// 讀取圖片文件並轉換為 base64
async function readImageAsBase64(filename: string): Promise<string | null> {
  try {
    const uploadDir = join(process.cwd(), "public", "uploads");
    const filepath = join(uploadDir, filename);
    if (!existsSync(filepath)) return null;
    const buffer = await readFile(filepath);
    return buffer.toString("base64");
  } catch {
    return null;
  }
}

export const GET = apiHandler(async (_req: NextRequest) => {
  const session = await requirePermission("settings.export");
  const dump: Record<string, any[]> = {};
  
  // 備份資料庫表格
  for (const t of BACKUP_TABLES) {
    try {
      // @ts-ignore - dynamic table access
      const rows = await (prisma as any)[t].findMany();
      dump[t] = rows;
    } catch (e) {
      dump[t] = [];
    }
  }
  
  // 備份圖片文件
  const images: Record<string, string> = {};
  try {
    const uploadDir = join(process.cwd(), "public", "uploads");
    if (existsSync(uploadDir)) {
      const files = await readdir(uploadDir);
      for (const file of files) {
        const base64 = await readImageAsBase64(file);
        if (base64) {
          images[file] = base64;
        }
      }
    }
  } catch (e) {
    console.error("備份圖片時出錯:", e);
  }
  
  await audit({ userId: session.user.id, action: "export_backup", module: "settings" });
  const body = JSON.stringify({
    version: 2, // 版本 2 包含圖片備份
    generatedAt: new Date().toISOString(),
    tables: dump,
    images: images,
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="erp-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
