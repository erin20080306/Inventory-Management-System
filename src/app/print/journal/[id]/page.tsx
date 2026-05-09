import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/api";
import { notFound } from "next/navigation";
import { AutoPrint } from "../../auto-print";
import { CompanyHeader } from "../../CompanyHeader";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PrintJournal({ params }: { params: { id: string } }) {
  await requirePermission("journals.view");
  const entry = await prisma.journalEntry.findUnique({
    where: { id: params.id },
    include: { lines: { include: { account: true } }, createdBy: true },
  });
  if (!entry) notFound();

  const totalDebit = entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);

  // 金額中文大寫
  function toChineseAmount(n: number): string {
    if (!n) return "零元整";
    const digits = ["零", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
    const units = ["", "拾", "佰", "仟"];
    const bigUnits = ["", "萬", "億"];
    const [intStr, decStr = ""] = String(Math.abs(n).toFixed(2)).split(".");
    let result = "";
    let gi = 0;
    let rest = intStr;
    while (rest.length > 0) {
      const group = rest.slice(-4);
      rest = rest.slice(0, -4);
      let gStr = "";
      for (let i = 0; i < group.length; i++) {
        const d = Number(group[i]);
        const u = group.length - 1 - i;
        gStr += (d === 0 ? "零" : digits[d] + units[u]);
      }
      gStr = gStr.replace(/零+/g, "零").replace(/零$/, "");
      result = (gStr ? gStr + bigUnits[gi] : "") + result;
      gi++;
    }
    result += "元";
    const d1 = Number(decStr[0] ?? 0);
    const d2 = Number(decStr[1] ?? 0);
    if (d1 === 0 && d2 === 0) result += "整";
    else result += (d1 ? digits[d1] + "角" : "") + (d2 ? digits[d2] + "分" : "");
    return result;
  }

  const statusLabel: Record<string, string> = { DRAFT: "草稿", POSTED: "已過帳", VOID: "已作廢" };

  // 將金額拆成 11 個位數欄 (億千百十萬千百十元角分)
  const AMOUNT_UNITS = ["億", "仟", "佰", "拾", "萬", "仟", "佰", "拾", "元", "角", "分"];
  function splitAmount(n: number): string[] {
    if (!n) return AMOUNT_UNITS.map(() => "");
    const cents = Math.round(Math.abs(n) * 100);
    const intPart = Math.floor(cents / 100);
    const fracPart = cents % 100;
    const intStr = String(intPart);
    const padded = intStr.padStart(9, " ");
    const arr = padded.split("").map((c) => (c === " " ? "" : c));
    arr.push(String(Math.floor(fracPart / 10)));
    arr.push(String(fracPart % 10));
    // 結果長度 11，對應 AMOUNT_UNITS
    return arr;
  }

  // 中式年月日 (民國年)
  const d = new Date(entry.entryDate);
  const rocYear = d.getFullYear() - 1911;
  const dateStr = `中華民國 ${rocYear} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;

  // 推測傳票類型 (現金收入 / 現金支出 / 轉帳)
  const cashCodes = new Set(["1101", "1102", "1103", "1104", "1105"]);
  const cashDebit = entry!.lines.some((l: any) => cashCodes.has(l.account.code) && Number(l.debit) > 0);
  const cashCredit = entry!.lines.some((l: any) => cashCodes.has(l.account.code) && Number(l.credit) > 0);
  function guessVoucherKind(): string {
    if (cashDebit && !cashCredit) return "現金收入傳票";
    if (cashCredit && !cashDebit) return "現金支出傳票";
    return "轉帳傳票";
  }

  const voucherKind = guessVoucherKind();

  return (
    <>
      <AutoPrint />
      <div className="sheet">
        <CompanyHeader />
        <div className="doc-title">傳　票　憑　證</div>
        <div style={{ textAlign: "center", fontSize: 14, marginTop: -8, marginBottom: 10, letterSpacing: 4 }}>
          【{voucherKind}】
        </div>

        <div className="meta">
          <div><span className="label">傳票編號：</span>{entry.number}</div>
          <div><span className="label">日　　期：</span>{dateStr}</div>
          <div style={{ gridColumn: "1 / span 2" }}>
            <span className="label">摘　　要：</span>{entry.summary || "—"}
          </div>
          <div><span className="label">狀　　態：</span>{statusLabel[entry.status] ?? entry.status}</div>
          <div><span className="label">金額大寫：</span>新台幣 {toChineseAmount(totalDebit)}</div>
        </div>

        <table className="doc-table cn-voucher">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: "10%" }}>科目編號</th>
              <th rowSpan={2} style={{ width: "18%" }}>會計科目</th>
              <th rowSpan={2} style={{ width: "20%" }}>摘要</th>
              <th colSpan={11} className="num">借　方　金　額</th>
              <th colSpan={11} className="num">貸　方　金　額</th>
            </tr>
            <tr>
              {AMOUNT_UNITS.map((u, i) => <th key={`d${i}`} className="unit-cell">{u}</th>)}
              {AMOUNT_UNITS.map((u, i) => <th key={`c${i}`} className="unit-cell">{u}</th>)}
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((l: any) => {
              const dArr = splitAmount(Number(l.debit));
              const cArr = splitAmount(Number(l.credit));
              return (
                <tr key={l.id}>
                  <td>{l.account.code}</td>
                  <td>{l.account.name}</td>
                  <td>{l.memo ?? ""}</td>
                  {dArr.map((v, i) => <td key={`d${i}`} className="unit-cell num">{v}</td>)}
                  {cArr.map((v, i) => <td key={`c${i}`} className="unit-cell num">{v}</td>)}
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, 6 - entry.lines.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td>&nbsp;</td><td></td><td></td>
                {Array.from({ length: 22 }).map((_, j) => <td key={j} className="unit-cell"></td>)}
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
              <td colSpan={3} style={{ textAlign: "right" }}>合　計</td>
              {splitAmount(totalDebit).map((v, i) => <td key={`td${i}`} className="unit-cell num">{v}</td>)}
              {splitAmount(totalCredit).map((v, i) => <td key={`tc${i}`} className="unit-cell num">{v}</td>)}
            </tr>
          </tbody>
        </table>

        <div className="signatures">
          <div className="sig-box" data-label="董事長"></div>
          <div className="sig-box" data-label="總經理"></div>
          <div className="sig-box" data-label="會計主管"></div>
          <div className="sig-box" data-label="覆　核"></div>
          <div className="sig-box" data-label="出　納"></div>
          <div className="sig-box" data-label="記　帳"></div>
          <div className="sig-box" data-label="審　核"></div>
          <div className="sig-box" data-label="製　單">{entry.createdBy?.name ?? ""}</div>
        </div>

        <div className="footer-note">
          本憑證連同所附單據共 ____ 張。　列印時間：{new Date().toLocaleString("zh-TW")}
        </div>
      </div>
    </>
  );
}
