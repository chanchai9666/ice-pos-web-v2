"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext.tsx";
import { ThemeToggle } from "../theme/ThemeToggle.tsx";
import { syncService } from "../../services/syncService.ts";
import { offlineStorage } from "../../services/offlineStorage.ts";
import { useToast } from "../../context/ToastContext.tsx";
import {
  Wifi,
  WifiOff,
  History,
  BarChart3,
  LogOut,
  RefreshCw,
  User as UserIcon,
  ShoppingCart,
  Users as UsersIcon,
  Package,
  FileText,
  UserCheck,
  Menu,
} from "lucide-react";

interface HeaderBarProps {
  onOpenHistory?: () => void;
  onOpenDailySummary?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenHistory,
  onOpenDailySummary,
}) => {
  const pathname = usePathname();
  const { user, isOffline, logout } = useAuth();
  const { toast } = useToast();
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return "ยังไม่เคยซิงค์";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "ยังไม่เคยซิงค์";
      return d.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "ยังไม่เคยซิงค์";
    }
  };

  // Listen for storage events (e.g. sale queued in another tab or checkout modal)
  useEffect(() => {
    const updateOfflineCount = () => {
      setOfflineCount(offlineStorage.getOfflineSales().length);
      setLastSync(offlineStorage.getLastSyncTime());
    };
    updateOfflineCount();

    window.addEventListener("storage", updateOfflineCount);
    const interval = setInterval(updateOfflineCount, 5000);
    return () => {
      window.removeEventListener("storage", updateOfflineCount);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = useCallback(async () => {
    if (isSyncing || isOffline) return;
    setIsSyncing(true);
    try {
      const res = await syncService.runFullSyncCycle();
      if (res.success) {
        if (res.syncedSales > 0) {
          toast.success(
            `ซิงค์ข้อมูลสำเร็จ: ส่งบิล ${res.syncedSales} รายการ พร้อมอัปเดตข้อมูลล่าสุด`
          );
        } else {
          toast.success(
            "อัปเดตข้อมูลล่าสุด (สินค้า, ลูกค้า, หนี้การค้า, ผู้ใช้) เรียบร้อยแล้ว"
          );
        }
      } else {
        toast.warning(res.error || "การซิงค์ข้อมูลล้มเหลว");
      }
    } catch {
      toast.error("การซิงค์ข้อมูลล้มเหลว กรุณาตรวจสอบการเชื่อมต่อ");
    } finally {
      setOfflineCount(offlineStorage.getOfflineSales().length);
      setLastSync(offlineStorage.getLastSyncTime());
      setIsSyncing(false);
    }
  }, [isSyncing, isOffline, toast]);

  // Demand-Driven Auto-Sync with Exponential Backoff:
  // Runs ONLY when there are offline sales waiting to be synced (offlineCount > 0)
  useEffect(() => {
    if (offlineCount === 0 || isOffline) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let delay = 5000; // start at 5s
    let isCancelled = false;

    const attemptSync = async () => {
      if (isCancelled || isSyncing) return;
      try {
        const res = await syncService.runFullSyncCycle();
        if (res && res.success) {
          if (res.syncedSales > 0) {
            toast.success(`ซิงค์ข้อมูลสำเร็จ: ${res.syncedSales} บิล`);
          }
          const remaining = offlineStorage.getOfflineSales().length;
          setOfflineCount(remaining);
          setLastSync(offlineStorage.getLastSyncTime());
          if (remaining === 0) {
            return; // All synced, stop retry loop
          }
        }
      } catch {
        // Increase backoff delay up to 60s
        delay = Math.min(delay * 2, 60000);
      }

      if (!isCancelled && offlineStorage.getOfflineSales().length > 0) {
        timeoutId = setTimeout(attemptSync, delay);
      }
    };

    // First attempt after 2s
    timeoutId = setTimeout(attemptSync, 2000);

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [offlineCount, isOffline, isSyncing, toast]);

  // Periodic background sync every 2 minutes when online
  useEffect(() => {
    if (isOffline) return;

    const periodicInterval = setInterval(async () => {
      if (isSyncing || isOffline) return;
      try {
        const res = await syncService.runFullSyncCycle();
        if (res.success && res.syncedSales > 0) {
          toast.success(`ซิงค์ข้อมูลอัตโนมัติสำเร็จ: ${res.syncedSales} บิล`);
        }
        setOfflineCount(offlineStorage.getOfflineSales().length);
        setLastSync(offlineStorage.getLastSyncTime());
      } catch {
        // Silent failure in background interval
      }
    }, 120000);

    return () => clearInterval(periodicInterval);
  }, [isOffline, isSyncing, toast]);

  // When network comes back online, try sync immediately
  useEffect(() => {
    const handleOnline = () => {
      const count = offlineStorage.getOfflineSales().length;
      setOfflineCount(count);
      if (!isSyncing) {
        handleManualSync();
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [isSyncing, handleManualSync]);

  const handleLogoutClick = () => {
    if (window.confirm("คุณต้องการออกจากระบบหรือไม่?")) {
      logout();
    }
  };

  const navItems = [
    { label: "ขายหน้าร้าน", href: "/", icon: ShoppingCart },
    { label: "ลูกค้า & หนี้การค้า", href: "/customers", icon: UsersIcon },
    { label: "จัดการสินค้า", href: "/catalog", icon: Package },
    { label: "รายงาน", href: "/reports", icon: FileText },
    ...(user?.role?.toLowerCase() === "admin"
      ? [{ label: "พนักงาน", href: "/users", icon: UserCheck }]
      : []),
  ];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="no-print bg-base-100 border-b-2 border-base-300 px-3 py-2 sm:px-6 sm:py-2.5 shadow-xs sticky top-0 z-30">
      <div className="flex items-center justify-between gap-4">
        {/* Left Section: Brand & Primary Navigation (Left-Anchored & Stable) */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 hover:opacity-95 transition-opacity"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-primary text-primary-content flex items-center justify-center font-black text-xl sm:text-2xl shadow-xs">
              🧊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-2xl font-black text-primary leading-tight tracking-tight">
                  ICE POS
                </span>
                {isOffline ? (
                  <span className="badge badge-warning text-[10px] font-black py-0.5 px-1.5 rounded-md gap-1">
                    <WifiOff className="w-2.5 h-2.5" />
                    <span>ออฟไลน์</span>
                  </span>
                ) : (
                  <span className="badge badge-success text-white text-[10px] font-black py-0.5 px-1.5 rounded-md gap-1">
                    <Wifi className="w-2.5 h-2.5" />
                    <span>ออนไลน์</span>
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-base-content/70 mt-0.5">
                <UserIcon className="w-3.5 h-3.5 text-base-content/50" />
                <span className="hidden sm:inline">แคชเชียร์: </span>
                <span className="font-bold text-base-content truncate max-w-[120px] sm:max-w-[160px]">
                  {user?.display_name || user?.username || "เจ้าหน้าที่"}
                </span>
              </div>
            </div>
          </Link>

          {/* Vertical divider */}
          <div className="hidden xl:block w-px h-8 bg-base-300" />

          {/* Primary Navigation - Segmented Pill Bar (Pinned to Left) */}
          <nav className="hidden lg:flex items-center bg-base-200/60 p-1 rounded-2xl border border-base-300 shadow-2xs shrink-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`btn btn-sm h-9 px-3.5 font-bold rounded-xl gap-2 transition-all border-none ${
                    isActive
                      ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                      : "btn-ghost hover:bg-base-200 text-base-content/70 hover:text-base-content"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-bold whitespace-nowrap">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Utilities & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Offline sync indicator & Manual Sync button */}
          <div className="flex items-center">
            {offlineCount > 0 ? (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing || isOffline}
                className="btn btn-warning btn-sm h-9.5 text-xs font-black rounded-xl gap-1.5 shadow-xs px-2.5 sm:px-3"
                title="กดเพื่อส่งบิลออฟไลน์ขึ้นเซิร์ฟเวอร์ และอัปเดตข้อมูลล่าสุด"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
                />
                <span>รอซิงค์ {offlineCount}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing || isOffline}
                className="btn btn-outline border-base-300 hover:border-primary btn-sm h-9.5 px-2.5 sm:px-3 text-xs font-bold rounded-xl gap-1.5 text-base-content/80 hover:text-base-content shadow-2xs bg-base-100"
                title="กดเพื่ออัปเดตข้อมูลล่าสุด (สินค้า, ลูกค้า, หนี้การค้า, ผู้ใช้) จากเซิร์ฟเวอร์"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-primary ${
                    isSyncing ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">อัปเดตข้อมูล</span>
                <span className="text-[10px] opacity-60 font-semibold hidden md:inline">
                  ({formatSyncTime(lastSync)})
                </span>
              </button>
            )}
          </div>

          {/* Contextual Actions (e.g. Sales History / Daily Summary on Cashier page) */}
          {(onOpenHistory || onOpenDailySummary) && (
            <div className="hidden sm:flex items-center gap-1.5 bg-base-200/60 p-1 rounded-2xl border border-base-300 shadow-2xs">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="btn btn-ghost hover:bg-base-100 btn-sm h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-bold rounded-xl gap-1.5 text-base-content transition-all"
                  title="ประวัติรายการขาย"
                >
                  <History className="w-4 h-4 text-primary" />
                  <span className="hidden lg:inline">ประวัติบิล</span>
                </button>
              )}

              {onOpenDailySummary && (
                <button
                  type="button"
                  onClick={onOpenDailySummary}
                  className="btn btn-ghost hover:bg-base-100 btn-sm h-8 px-2.5 sm:px-3 text-xs sm:text-sm font-bold rounded-xl gap-1.5 text-base-content transition-all"
                  title="สรุปยอดขายประจำวัน"
                >
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="hidden lg:inline">สรุปยอดขาย</span>
                </button>
              )}
            </div>
          )}

          {/* Theme Switcher */}
          <ThemeToggle compact />

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogoutClick}
            className="btn btn-ghost btn-square btn-sm h-9.5 w-9.5 text-error hover:bg-error/10 rounded-xl"
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="btn btn-ghost btn-square btn-sm h-9.5 w-9.5 rounded-xl lg:hidden"
            aria-label="เปิดเมนูนำทาง"
          >
            <Menu className="w-5 h-5 text-base-content" />
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden pt-3 pb-1 border-t border-base-200 mt-2.5 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2.5">
          {/* User profile on mobile menu */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-base-200/60 rounded-xl text-xs font-bold text-base-content/80">
            <span className="flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-base-content/50" />
              แคชเชียร์: {user?.display_name || user?.username || "เจ้าหน้าที่"}
            </span>
            <span className="text-[10px] opacity-60">
              ซิงค์ล่าสุด: {formatSyncTime(lastSync)}
            </span>
          </div>

          {/* Quick Actions on Mobile (History & Daily Summary) */}
          {(onOpenHistory || onOpenDailySummary) && (
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenHistory();
                  }}
                  className="btn btn-outline border-base-300 btn-sm h-10 rounded-xl font-bold flex items-center justify-center gap-1.5 bg-base-100"
                >
                  <History className="w-4 h-4 text-primary" />
                  <span>ประวัติบิล</span>
                </button>
              )}
              {onOpenDailySummary && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenDailySummary();
                  }}
                  className="btn btn-outline border-base-300 btn-sm h-10 rounded-xl font-bold flex items-center justify-center gap-1.5 bg-base-100"
                >
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span>สรุปยอดขาย</span>
                </button>
              )}
            </div>
          )}

          {/* Main Navigation links */}
          <nav className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`btn btn-sm h-11 px-3 font-bold rounded-xl gap-2 transition-all justify-start ${
                    isActive
                      ? "bg-indigo-600 dark:bg-indigo-500 text-white border-none shadow-sm"
                      : "btn-outline border-base-300 bg-base-100 text-base-content/80"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-bold truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};
