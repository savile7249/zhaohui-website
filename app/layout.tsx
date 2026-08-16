import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "兆辉化工设备 | 为严苛工况制造",
  description: "钢衬四氟塔器、储罐及反应设备品牌展示首页。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
