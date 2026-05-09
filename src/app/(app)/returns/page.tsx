import { PageShell } from "@/components/layout/page-shell";
import { requirePermissionOrForbidden } from "@/components/perm-guard";
import { prisma } from "@/lib/prisma";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Page() {
  const g = await requirePermissionOrForbidden("returns.view");
  if (g.forbidden) return g.element;
  const [sales, purchases] = await Promise.all([
    prisma.salesReturn.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.purchaseReturn.findMany({ include: { supplier: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return (
    <PageShell title="退貨管理" description="銷售退貨 / 採購退貨，自動調整庫存與帳款">
      <Card>
        <CardHeader><CardTitle>銷售退貨</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>單號</TH><TH>客戶</TH><TH>日期</TH><TH>原因</TH><TH>總計</TH><TH>狀態</TH></TR></THead>
            <TBody>
              {sales.length === 0 && <TR><TD colSpan={6} className="text-center text-muted-foreground">尚無資料</TD></TR>}
              {sales.map((r: any) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.number}</TD>
                  <TD>{r.customer.companyName}</TD>
                  <TD>{formatDate(r.returnDate)}</TD>
                  <TD>{r.reason ?? "—"}</TD>
                  <TD>{formatMoney(r.total)}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>採購退貨</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>單號</TH><TH>供應商</TH><TH>日期</TH><TH>原因</TH><TH>總計</TH><TH>狀態</TH></TR></THead>
            <TBody>
              {purchases.length === 0 && <TR><TD colSpan={6} className="text-center text-muted-foreground">尚無資料</TD></TR>}
              {purchases.map((r: any) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.number}</TD>
                  <TD>{r.supplier.companyName}</TD>
                  <TD>{formatDate(r.returnDate)}</TD>
                  <TD>{r.reason ?? "—"}</TD>
                  <TD>{formatMoney(r.total)}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
