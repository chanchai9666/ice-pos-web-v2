import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["thai", "latin"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ICE POS v2 - ระบบขายหน้าร้าน",
  description:
    "ระบบขายหน้าร้านสำหรับแคชเชียร์ ใช้งานง่าย เหมาะสำหรับผู้สูงอายุ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-theme="light" className={`${sarabun.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-base-100 text-base-content">
        {children}
      </body>
    </html>
  );
}
