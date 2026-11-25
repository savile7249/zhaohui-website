import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jszhff.cn"),
  title: {
    default: "兆辉化工设备 | 钢衬防腐储罐、反应釜、塔器与管道",
    template: "%s | 兆辉化工设备",
  },
  description:
    "江苏兆辉防腐科技有限公司专注钢衬四氟、PO、PE、PFA、PVDF 等防腐储罐、反应釜、塔器与管道制造，配套板衬、滚塑与喷涂工艺。",
  keywords: [
    "兆辉化工设备",
    "江苏兆辉防腐科技",
    "钢衬四氟储罐",
    "钢衬PO储罐",
    "钢衬PE储罐",
    "钢衬防腐反应釜",
    "钢衬防腐塔器",
    "钢衬四氟管道",
    "化工防腐设备",
  ],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://jszhff.cn/",
    siteName: "兆辉化工设备",
    title: "兆辉化工设备 | 钢衬防腐储罐、反应釜、塔器与管道",
    description:
      "专注钢衬四氟、PO、PE、PFA、PVDF 等防腐储罐、反应釜、塔器与管道制造，配套板衬、滚塑与喷涂工艺。",
    images: [
      {
        url: "/images/site/hero-cleanroom.webp",
        width: 1920,
        height: 1080,
        alt: "洁净车间内的钢衬防腐储罐与反应设备实拍",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "兆辉化工设备 | 钢衬防腐储罐、反应釜、塔器与管道",
    description:
      "专注钢衬四氟、PO、PE、PFA、PVDF 等防腐储罐、反应釜、塔器与管道制造。",
    images: ["/images/site/hero-cleanroom.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#05090d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
