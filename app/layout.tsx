import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "兆辉化工设备 | 为严苛工况制造",
  description: "储罐、反应釜、塔器及管道产品与化工设备制造能力。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
