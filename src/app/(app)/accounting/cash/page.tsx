import { PageShell } from "@/components/layout/page-shell";
import { requirePermissionOrForbidden } from "@/components/perm-guard";
import { prisma } from "@/lib/prisma";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Page() {
  const g = await requirePermissionOrForbidden("cash.view");
  if (g.forbidden) return g.element;
  const [cash, bank] = await Promise.all([
    prisma.cashAccount.findMany({ orderBy: { code: "asc" } }),
    prisma.bankAccount.findMany({ orderBy: { code: "asc" } }),
  ]);
  return (
    <PageShell title="現金銀行" description="現金帳戶與銀行帳戶、轉帳與對帳">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>現金帳戶</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>編號</TH><TH>名稱</TH><TH>餘額</TH></TR></THead>
              <TBody>
                {cash.map((c: any) => (
                  <TR key={c.id}>
                    <TD className="font-mono text-xs">{c.code}</TD>
                    <TD>{c.name}</TD>
                    <TD>{formatMoney(c.balance)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>銀行帳戶</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>編號</TH><TH>名稱</TH><TH>銀行</TH><TH>帳號</TH><TH>餘額</TH></TR></THead>
              <TBody>
                {bank.map((b: any) => (
                  <TR key={b.id}>
                    <TD className="font-mono text-xs">{b.code}</TD>
                    <TD>{b.name}</TD>
                    <TD>{b.bankName ?? "—"}</TD>
                    <TD className="font-mono text-xs">{b.accountNumber ?? "—"}</TD>
                    <TD>{formatMoney(b.balance)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
