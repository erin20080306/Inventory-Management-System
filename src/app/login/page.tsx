"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, User, Building2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/dashboard";
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { username, password, redirect: false, callbackUrl });
    setLoading(false);
    if (res?.error) {
      toast.error(res.error === "CredentialsSignin" ? "帳號或密碼錯誤" : res.error);
      return;
    }
    toast.success("登入成功");
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold">專業 ERP 系統</h1>
            <p className="text-xs text-muted-foreground">進銷存 / 會計 / 報表</p>
          </div>
        </div>
        <Card className="shadow-xl border-slate-200/50">
          <CardHeader>
            <CardTitle>管理後台登入</CardTitle>
            <CardDescription>請輸入帳號與密碼</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">帳號</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密碼</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                登入
              </Button>
            </form>
            <div className="mt-6 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <div className="font-medium mb-1">預設管理員帳號</div>
              帳號：<code className="px-1 rounded bg-muted">admin</code>　密碼：<code className="px-1 rounded bg-muted">661012</code>
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Professional ERP System</p>
      </div>
    </div>
  );
}
