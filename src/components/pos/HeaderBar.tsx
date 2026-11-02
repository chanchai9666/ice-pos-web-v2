"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import { ThemeToggle } from "../theme/ThemeToggle.tsx";
import { syncService } from "../../services/syncService.ts";
import { offlineStorage } from "../../services/offlineStorage.ts";
import {
  Wifi,
  WifiOff,
  History,
  BarChart3,
  LogOut,
  RefreshCw,
  User as UserIcon,
} from "lucide-react";

interface HeaderBarProps {
  onOpenHistory: () => void;
  onOpenDailySummary: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenHistory,
  onOpenDailySummary,
}) => {
  const { user, isOffline, logout } = useAuth();
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const updateOfflineCount = () => {
      setOfflineCount(offlineStorage.getOfflineSales().length);
    };
    updateOfflineCount();
    const interval = setInterval(updateOfflineCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (isSyncing || isOffline) return;
    setIsSyncing(true);
    try {
      const res = await syncService.syncOfflineSales();
      if (res) {
        alert(`ซิงค์ข้อมูลสำเร็จ: ${res.synced_sales} บิล`);
        setOfflineCount(offlineStorage.getOfflineSales().length);
      }
    } catch {
      alert("การซิงค์ข้อมูลล้มเหลว กรุณาตรวจสอบการเชื่อมต่อ");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogoutClick = () => {
    if (window.confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      logout();
    }
  };

  return (
    <header className="no-print bg-base-100 border-b-2 border-base-300 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
      {/* Brand & Cashier Profile */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-primary text-primary-content flex items-center justify-center font-black text-2xl shadow-sm">
          🧊
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-primary leading-none">
              ICE POS
            </h1>
            {isOffline ? (
              <span className="badge badge-warning text-xs font-black gap-1 py-1.5 px-2 rounded-lg">
                <WifiOff className="w-3.5 h-3.5" />
                <span>ออฟไลน์</span>
              </span>
            ) : (
              <span className="badge badge-success text-white text-xs font-black gap-1 py-1.5 px-2 rounded-lg">
                <Wifi className="w-3.5 h-3.5" />
                <span>ออนไลน์</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-base-content/70 mt-0.5">
            <UserIcon className="w-3.5 h-3.5" />
            <span>แคชเชียร์: </span>
            <span className="font-bold text-base-content">
              {user?.full_name || user?.username || "เจ้าหน้าที่"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Navigation Buttons */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Offline sync indicator */}
        {offlineCount > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing || isOffline}
            className="btn btn-warning btn-sm h-12 text-sm font-bold rounded-xl gap-1.5 shadow-xs"
            title="กดเพื่อส่งบิลออฟไลน์ขึ้นเซิร์ฟเวอร์"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
            />
            <span>รอซิงค์ {offlineCount} บิล</span>
          </button>
        )}

        {/* History Modal Button */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="btn btn-outline h-12 px-4 text-base font-bold rounded-xl border-2 flex items-center gap-2 hover:bg-base-200"
        >
          <History className="w-5 h-5 text-primary" />
          <span className="hidden sm:inline">ประวัติบิล</span>
        </button>

        {/* Daily Summary Button */}
        <button
          type="button"
          onClick={onOpenDailySummary}
          className="btn btn-outline h-12 px-4 text-base font-bold rounded-xl border-2 flex items-center gap-2 hover:bg-base-200"
        >
          <BarChart3 className="w-5 h-5 text-primary" />
          <span className="hidden sm:inline">สรุปยอดขาย</span>
        </button>

        {/* Theme Switcher */}
        <ThemeToggle />

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogoutClick}
          className="btn btn-ghost btn-square h-12 w-12 text-error hover:bg-error/10 rounded-xl"
          title="ออกจากระบบ"
          aria-label="ออกจากระบบ"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};
