"use client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/layout/page-shell";
import { Plus, Search, Loader2, Edit2, Trash2, Download, Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import { downloadCSV, toCSV } from "@/lib/csv";

function PDFBtn({ title, filename }: { title: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { exportPageToPDF } = await import("@/lib/export-pdf");
          await exportPageToPDF(title, filename);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      PDF
    </Button>
  );
}

export type Column<T> = {
  key: string;
  title: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  csv?: (row: T) => any; // CSV 匯出值 (若未提供則用 row[key])
};

export function CrudTable<T extends { id: string }>({
  endpoint,
  columns,
  searchPlaceholder = "搜尋...",
  canCreate = true,
  canEdit = true,
  canDelete = true,
  FormDialog,
  initialQuery,
  exportable = true,
  exportName = "export",
  pdfTitle = "",
}: {
  endpoint: string;
  columns: Column<T>[];
  searchPlaceholder?: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  exportable?: boolean;
  exportName?: string;
  pdfTitle?: string;
  FormDialog: React.FC<{ open: boolean; onClose: () => void; row: T | null; onSaved: () => void }>;
  initialQuery?: Record<string, string>;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize), ...(initialQuery ?? {}) });
      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error || "載入失敗");
      const data = await res.json();
      setRows(data.items);
      setTotal(data.total);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, q, page, initialQuery]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(row: T) {
    if (!confirm("確定要刪除？")) return;
    try {
      const res = await fetch(`${endpoint}/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "刪除失敗");
      toast.success("已刪除");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9 w-72"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <PDFBtn title={pdfTitle || exportName} filename={exportName} />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            列印
          </Button>
          {exportable && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const params = new URLSearchParams({ q, page: "1", pageSize: "10000", ...(initialQuery ?? {}) });
                  const res = await fetch(`${endpoint}?${params.toString()}`);
                  const data = await res.json();
                  const csv = toCSV(
                    data.items,
                    columns.map((c) => ({ key: c.key, title: c.title, get: c.csv })) as any
                  );
                  downloadCSV(`${exportName}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  toast.success("已匯出 CSV");
                } catch (e: any) {
                  toast.error(e.message || "匯出失敗");
                }
              }}
            >
              <Download className="h-4 w-4" />
              匯出 CSV
            </Button>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              新增
            </Button>
          )}
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            {columns.map((c) => (
              <TH key={c.key} className={c.className}>
                {c.title}
              </TH>
            ))}
            {(canEdit || canDelete) && <TH className="w-28 text-right">操作</TH>}
          </TR>
        </THead>
        <TBody>
          {loading && (
            <TR>
              <TD colSpan={columns.length + 1} className="text-center py-10">
                <Loader2 className="h-5 w-5 animate-spin inline-block" />
              </TD>
            </TR>
          )}
          {!loading && rows.length === 0 && (
            <TR>
              <TD colSpan={columns.length + 1}>
                <EmptyState />
              </TD>
            </TR>
          )}
          {!loading &&
            rows.map((row) => (
              <TR key={row.id}>
                {columns.map((c) => (
                  <TD key={c.key} className={c.className}>
                    {c.render ? c.render(row) : (row as any)[c.key] ?? "—"}
                  </TD>
                ))}
                {(canEdit || canDelete) && (
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(row);
                            setOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => onDelete(row)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TD>
                )}
              </TR>
            ))}
        </TBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>共 {total} 筆</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            上一頁
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一頁
          </Button>
        </div>
      </div>

      <FormDialog open={open} onClose={() => setOpen(false)} row={editing} onSaved={load} />
    </div>
  );
}
