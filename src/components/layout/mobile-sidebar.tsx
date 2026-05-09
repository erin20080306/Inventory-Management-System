"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarBrand, SidebarNav, SidebarFooter } from "./sidebar-nav";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 切換頁面時自動收合
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 鎖定 body 捲動
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden -ml-2"
        onClick={() => setOpen(true)}
        aria-label="開啟選單"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* 遮罩 */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* 抽屜 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-white/10 flex flex-col shadow-2xl transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="行動裝置側邊選單"
      >
        <div className="relative">
          <SidebarBrand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-white/70 hover:bg-white/10"
            aria-label="關閉選單"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarNav onNavigate={() => setOpen(false)} />
        <SidebarFooter />
      </aside>
    </>
  );
}
