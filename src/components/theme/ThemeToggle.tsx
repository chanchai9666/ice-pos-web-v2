"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  compact = false,
}) => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("ice_pos_theme") as "light" | "dark") || "light"
      );
    }
    return "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("ice_pos_theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="btn btn-ghost btn-square btn-sm h-9.5 w-9.5 rounded-xl border border-base-300 bg-base-100 hover:bg-base-200 shadow-2xs"
        aria-label={`สลับเป็นโหมด${theme === "light" ? "มืด" : "สว่าง"}`}
        title={`สลับเป็นโหมด${theme === "light" ? "มืด" : "สว่าง"}`}
      >
        {theme === "light" ? (
          <Moon
            className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400"
            aria-hidden="true"
          />
        ) : (
          <Sun className="w-4.5 h-4.5 text-amber-500" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-outline h-10 sm:h-12 px-3 sm:px-4 flex items-center gap-2 text-sm sm:text-base font-bold rounded-xl border-2 cursor-pointer transition-all active:scale-95 shadow-xs"
      aria-label={`สลับเป็นโหมด${theme === "light" ? "มืด" : "สว่าง"}`}
    >
      {theme === "light" ? (
        <>
          <Moon className="w-5 h-5 text-indigo-700" aria-hidden="true" />
          <span className="hidden sm:inline">โหมดมืด</span>
        </>
      ) : (
        <>
          <Sun className="w-5 h-5 text-amber-400" aria-hidden="true" />
          <span className="hidden sm:inline">โหมดสว่าง</span>
        </>
      )}
    </button>
  );
};
