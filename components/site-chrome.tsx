import Image from "next/image";
import Link from "next/link";

const navigation = [
  ["产品", "/products"],
  ["工程项目", "/#projects"],
  ["制造", "/#manufacturing"],
  ["关于兆辉", "/#about"],
  ["联系", "/#contact"],
] as const;

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 h-[72px] px-5 sm:px-[30px]">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between">
        <Link href="/" aria-label="兆辉化工设备首页" className="logo-link -translate-x-2 -translate-y-2">
          <Image src="/images/zhaohui-logo-transparent.png" alt="ZHAOHUI 兆辉" width={112} height={42} priority />
        </Link>
        <nav aria-label="主导航" className="desktop-nav items-center gap-8 text-[10px] text-white/78">
          {navigation.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <details className="mobile-menu">
          <summary>菜单</summary>
          <nav aria-label="移动端主导航">
            {navigation.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact" className="footer-section">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-[5.75vw] py-12 text-white/68 md:grid-cols-12 md:items-end">
        <div className="md:col-span-4">
          <Image src="/images/zhaohui-logo-transparent.png" alt="ZHAOHUI 兆辉" width={112} height={42} />
          <p className="mt-5 text-sm leading-7">兆辉化工设备</p>
        </div>
        <div className="max-w-[27rem] md:col-span-4">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-white/42">PROJECT BRIEF</p>
          <p className="mt-3 text-xs leading-6">
            项目沟通前，请准备介质、浓度、温度、压力及设备尺寸等工况资料，并提交给您的兆辉业务联系人。
          </p>
        </div>
        <nav aria-label="页脚导航" className="flex flex-wrap gap-x-7 gap-y-3 text-xs md:col-span-2">
          <Link href="/products">产品设备</Link>
          <Link href="/#manufacturing">制造能力</Link>
        </nav>
        <p className="text-xs md:col-span-2 md:text-right">© {new Date().getFullYear()} ZHAOHUI</p>
      </div>
    </footer>
  );
}
