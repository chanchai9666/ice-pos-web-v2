import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext.tsx";
import { ToastProvider } from "../context/ToastContext.tsx";
import { ServiceWorkerRegister } from "../components/pwa/ServiceWorkerRegister.tsx";

const sarabun = Sarabun({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["thai", "latin"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ICE POS v2 - ระบบขายหน้าร้าน",
  description:
    "ระบบขายหน้าร้านสำหรับแคชเชียร์ ใช้งานง่าย เหมาะสำหรับผู้สูงอายุ รองรับออฟไลน์ 100%",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ICE POS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-theme="light" className={`${sarabun.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-base-100 text-base-content">
        <ServiceWorkerRegister />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
