"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log(
              "PWA Service Worker registered with scope:",
              registration.scope
            );
          })
          .catch((err) => {
            console.warn("Service Worker registration failed:", err);
          });
      });
    } else if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV !== "production"
    ) {
      // In development, also register to allow offline testing
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Dev Service Worker registered:", registration.scope);
        })
        .catch(() => {});
    }
  }, []);

  return null;
}
