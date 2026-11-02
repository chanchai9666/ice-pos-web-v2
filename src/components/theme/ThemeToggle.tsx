"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export const ThemeToggle: React.FC = () => {
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

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn btn-outline h-13 px-4 flex items-center gap-2 text-lg font-bold rounded-xl border-2 cursor-pointer transition-all active:scale-95 shadow-sm"
      aria-label={`สลับเป็นโหมด${theme === "light" ? "มืด" : "สว่าง"}`}
    >
      {theme === "light" ? (
        <>
          <Moon className="w-6 h-6 text-indigo-700" aria-hidden="true" />
          <span>โหมดมืด</span>
        </>
      ) : (
        <>
          <Sun className="w-6 h-6 text-amber-400" aria-hidden="true" />
          <span>โหมดสว่าง</span>
        </>
      )}
    </button>
  );
};
