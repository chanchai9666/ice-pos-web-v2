"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext.tsx";
import { PinPad } from "../../components/auth/PinPad.tsx";
import { ThemeToggle } from "../../components/theme/ThemeToggle.tsx";
import { ShieldCheck, UserCheck, KeyRound, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPin, loginWithCredentials, isLoading } = useAuth();
  const [mode, setMode] = useState<"pin" | "credentials">("pin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states for credentials mode
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handlePinSubmit = async (pin: string) => {
    setErrorMessage(null);
    const result = await loginWithPin(pin);
    if (result.success) {
      router.push("/");
    } else {
      setErrorMessage(result.error || "รหัส PIN ไม่ถูกต้อง");
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!username.trim() || !password) {
      setErrorMessage("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    const result = await loginWithCredentials(username, password);
    if (result.success) {
      router.push("/");
    } else {
      setErrorMessage(result.error || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar with Brand & Theme Toggle */}
      <header className="flex justify-between items-center max-w-4xl w-full mx-auto pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-primary-content flex items-center justify-center font-black text-2xl shadow-md">
            🧊
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-primary tracking-tight">
              ICE POS v2
            </h1>
            <p className="text-sm font-semibold text-base-content/70">
              ระบบขายหน้าร้าน
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Card Container */}
      <main className="flex-1 flex items-center justify-center py-6">
        <div className="card bg-base-100 shadow-xl border border-base-300 w-full max-w-md p-6 sm:p-8 rounded-3xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-base-content">
              {mode === "pin"
                ? "เข้าสู่ระบบแคชเชียร์"
                : "เข้าสู่ระบบด้วยชื่อผู้ใช้"}
            </h2>
            <p className="text-base sm:text-lg font-medium text-base-content/70 mt-1">
              {mode === "pin"
                ? "กดรหัสตัวเลข PIN 4–6 หลักเพื่อเริ่มงาน"
                : "สำหรับผู้ดูแลระบบหรือหัวหน้างาน"}
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="alert alert-error mb-6 rounded-2xl text-base font-bold shadow-sm flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === "pin" ? (
            <PinPad
              onComplete={handlePinSubmit}
              isLoading={isLoading}
              maxLength={6}
            />
          ) : (
            <form
              onSubmit={handleCredentialsSubmit}
              className="flex flex-col gap-5"
            >
              <div>
                <label className="label text-lg font-bold text-base-content">
                  ชื่อผู้ใช้ (Username)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้..."
                    className="input input-bordered w-full h-16 text-xl pl-12 rounded-2xl border-2"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                  <UserCheck className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
                </div>
              </div>

              <div>
                <label className="label text-lg font-bold text-base-content">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน..."
                    className="input input-bordered w-full h-16 text-xl pl-12 rounded-2xl border-2"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <KeyRound className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/50" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary h-16 text-2xl font-bold rounded-2xl mt-4 shadow-lg active:scale-98"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-lg"></span>
                ) : (
                  "เข้าสู่ระบบ"
                )}
              </button>
            </form>
          )}

          {/* Mode Switcher */}
          <div className="divider my-6 text-sm font-semibold text-base-content/50">
            หรือ
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setMode(mode === "pin" ? "credentials" : "pin");
            }}
            className="btn btn-ghost h-14 text-lg font-bold rounded-xl text-primary flex items-center justify-center gap-2"
          >
            {mode === "pin" ? (
              <>
                <KeyRound className="w-5 h-5" />
                <span>สลับไปใช้ Username & Password</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>สลับไปใช้ PIN แคชเชียร์</span>
              </>
            )}
          </button>
        </div>
      </main>

      {/* Footer info */}
      <footer className="text-center text-sm font-medium text-base-content/50 pt-4">
        ระบบขายหน้าร้าน ICE POS v2 • รองรับการทำงานออฟไลน์
      </footer>
    </div>
  );
}
