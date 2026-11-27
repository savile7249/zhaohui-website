import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "./site-footer";
import "./site.css";

export default function NotFound() {
  return (
    <div className="pt-root">
      <a className="pt-skip-link" href="#pt-main">
        跳到主要内容
      </a>
      <SiteHeader briefHref="/#brief" scrolled surface="dark" />
      <main
        id="pt-main"
        className="is-dark"
        style={{
          minHeight: "64svh",
          display: "flex",
          alignItems: "center",
          background: "#0a0f13",
          color: "#f1f2f2",
          borderBottom: "1px solid rgb(255 255 255 / 0.14)",
          paddingBlock: "clamp(112px, 12vw, 160px)",
        }}
      >
        <div className="pt-wrap">
          <p className="pt-label">
            <span>404</span>
            页面不存在
          </p>
          <h1 className="pt-h2">未找到您访问的页面。</h1>
          <p className="pt-lead" style={{ marginTop: "20px", maxWidth: "36em", color: "rgb(241 242 242 / 0.68)" }}>
            链接可能已更新或移除。您可以返回兆辉化工设备首页，查看储罐、反应釜、塔器与管道产品信息。
          </p>
          <div style={{ marginTop: "36px", display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
            <Link href="/" className="pt-button">
              返回首页
            </Link>
            <Link href="/#equipment" className="pt-link is-inverse">
              查看全部设备
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
