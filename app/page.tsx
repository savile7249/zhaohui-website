import Image from "next/image";
import { Reveal } from "@/components/reveal";

const products = [
  {
    id: "equipment",
    index: "02",
    title: "钢衬四氟塔器",
    english: "STEEL / PTFE LINED COLUMN",
    summary: "吸收 / 洗涤 / 精馏",
    image: "/images/product-column.png",
    imageAlt: "厂房内的大型钢衬四氟塔器",
    objectPosition: "64% center",
    tone: "dark",
    align: "left",
    next: "vessel",
  },
  {
    id: "vessel",
    index: "03",
    title: "钢衬四氟储罐",
    english: "PTFE LINED VESSEL",
    summary: "储存 / 处理 / 耐腐蚀",
    image: "/images/product-vessel.png",
    imageAlt: "明亮厂房内的卧式钢衬四氟储罐",
    objectPosition: "40% center",
    tone: "light",
    align: "right",
    next: "reactor",
  },
  {
    id: "reactor",
    index: "04",
    title: "反应釜",
    english: "REACTION VESSEL",
    summary: "反应 / 混合 / 高效传热",
    image: "/images/product-reactor.png",
    imageAlt: "带有多组法兰接口的大型反应釜",
    objectPosition: "30% center",
    tone: "dark",
    align: "right",
    next: "projects",
  },
] as const;

function SectionLabel({ index, label, inverse = false }: { index: string; label: string; inverse?: boolean }) {
  return (
    <p className={`section-label ${inverse ? "text-white/72" : "text-[#171b1e]/72"}`}>
      <span>{index}</span> / {label}
    </p>
  );
}

function ProductSection({ product }: { product: (typeof products)[number] }) {
  const isDark = product.tone === "dark";
  const isRight = product.align === "right";

  return (
    <section id={product.id} className={`product-hero ${isDark ? "product-dark" : "product-light"}`}>
      <Image
        src={product.image}
        alt={product.imageAlt}
        fill
        loading="eager"
        sizes="100vw"
        style={{ objectPosition: product.objectPosition }}
        className="product-image"
      />
      <div className={`product-scrim ${isRight ? "scrim-right" : "scrim-left"}`} aria-hidden="true" />
      <div className="site-grid relative z-[1] h-full items-center px-[5.75vw]">
        <Reveal className={`${isRight ? "col-start-9 col-end-13 md:ml-8" : "col-start-1 col-end-6"} product-copy`}>
          <SectionLabel index={product.index} label="EQUIPMENT" inverse={isDark} />
          <h2>{product.title}</h2>
          <p className="product-english">{product.english}</p>
          <span className="accent-line" aria-hidden="true" />
          <p className="product-summary">{product.summary}</p>
          <a href={`#${product.next}`} className="text-link">
            探索设备
          </a>
        </Reveal>
      </div>
    </section>
  );
}

function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 h-[72px] px-5 sm:px-[30px]">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between">
        <a href="#top" aria-label="兆辉化工设备首页" className="logo-link -translate-x-2 -translate-y-2">
          <Image src="/images/zhaohui-logo-transparent.png" alt="ZHAOHUI 兆辉" width={112} height={42} priority />
        </a>
        <nav aria-label="主导航" className="desktop-nav items-center gap-8 text-[10px] text-white/78">
          <a href="#equipment">设备</a>
          <a href="#projects">工程项目</a>
          <a href="#manufacturing">制造</a>
          <a href="#about">关于兆辉</a>
          <a href="#contact">联系</a>
        </nav>
        <details className="mobile-menu">
          <summary>菜单</summary>
          <nav aria-label="移动端主导航">
            <a href="#equipment">设备</a>
            <a href="#projects">工程项目</a>
            <a href="#manufacturing">制造</a>
            <a href="#about">关于兆辉</a>
            <a href="#contact">联系</a>
          </nav>
        </details>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <main id="top">
      <Header />

      <section className="hero-section">
        <Image
          src="/images/hero-column.png"
          alt="暗色大型工业厂房内的钢衬四氟塔器"
          fill
          priority
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-scrim" aria-hidden="true" />
        <div className="site-grid relative z-[1] h-full items-center px-[5.75vw] pt-16">
          <div className="col-start-1 col-end-7 max-w-[640px] -translate-y-10 text-white">
            <SectionLabel index="00" label="ZHAOHUI" inverse />
            <h1 className="mt-9 text-[clamp(2.25rem,3.5vw,3.6rem)] font-semibold leading-[1.12] tracking-[-0.045em]">
              为严苛工况制造
            </h1>
            <p className="mt-5 text-[clamp(1rem,1.4vw,1.25rem)] font-light tracking-[0.04em] text-white/78">
              钢衬四氟塔器、储罐及反应设备
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="manifesto-section">
        <div className="site-grid mx-auto h-full max-w-[1600px] items-center px-[5.75vw]">
          <Reveal className="col-start-1 col-end-7 relative z-[1]">
            <SectionLabel index="01" label="ZHAOHUI" />
            <h2 className="mt-7 max-w-[680px] text-[clamp(1.65rem,2.55vw,3rem)] font-semibold leading-[1.38] tracking-[-0.035em] text-[#111518]">
              面对腐蚀、温度与复杂工况，
              <br />
              设备本身必须足够可靠。
            </h2>
            <span className="accent-line mt-8" aria-hidden="true" />
          </Reveal>
          <Image
            src="/images/column-blueprint-transparent.png"
            alt="塔器工程结构线稿"
            width={1122}
            height={1402}
            className="blueprint col-start-8 col-end-13 justify-self-center"
          />
        </div>
      </section>

      {products.map((product) => (
        <ProductSection key={product.id} product={product} />
      ))}

      <section id="projects" className="project-section">
        <Image
          src="/images/projects-plant.png"
          alt="多套塔器与管廊组成的化工工程项目现场"
          fill
          loading="eager"
          sizes="100vw"
          className="project-image"
        />
        <div className="project-scrim" aria-hidden="true" />
        <div className="site-grid relative z-[1] h-full items-start px-[5.75vw] pt-[clamp(2rem,3.5vw,3.5rem)]">
          <Reveal className="col-start-1 col-end-6 text-[#15191c]">
            <SectionLabel index="05" label="PROJECTS" />
            <h2 className="mt-4 text-[clamp(1.65rem,2.55vw,3rem)] font-semibold leading-tight tracking-[-0.04em]">
              精选工程项目
            </h2>
            <p className="mt-2 max-w-[34rem] text-xs leading-6 text-[#252a2e]/68">
              严苛工况下的制造与交付，源于每一处细节。
            </p>
            <a href="#manufacturing" className="text-link text-[#15191c]">
              查看制造
            </a>
          </Reveal>
        </div>
      </section>

      <section id="manufacturing" className="manufacturing-section">
        <Image
          src="/images/manufacturing-floor.png"
          alt="大型化工设备制造与装配现场"
          fill
          loading="eager"
          sizes="100vw"
          className="manufacturing-image"
        />
        <div className="manufacturing-scrim" aria-hidden="true" />
        <div className="site-grid relative z-[1] h-full items-end px-[5.75vw] pb-[clamp(4rem,8vw,7rem)]">
          <Reveal className="col-start-1 col-end-7 max-w-[680px] text-white">
            <SectionLabel index="06" label="MANUFACTURING" inverse />
            <h2 className="mt-6 text-[clamp(2rem,3.7vw,4rem)] font-semibold leading-tight tracking-[-0.04em]">
              从制造现场，建立可靠。
            </h2>
            <p className="mt-5 max-w-[34rem] text-base leading-8 text-white/68">
              材料、衬里、装配与检验，以一致的制造标准贯穿设备交付。
            </p>
          </Reveal>
        </div>
      </section>

      <section className="closing-section">
        <div className="site-grid mx-auto max-w-[1600px] px-[5.75vw] py-[clamp(5rem,10vw,10rem)]">
          <Reveal className="col-start-1 col-end-10">
            <p className="text-[clamp(2.15rem,5.4vw,6rem)] font-semibold leading-[1.12] tracking-[-0.055em] text-[#111518]">
              让设备，经得住现场。
            </p>
          </Reveal>
          <div className="col-start-10 col-end-13 self-end text-right text-xs leading-6 tracking-[0.08em] text-[#20262a]/58">
            CHEMICAL EQUIPMENT
            <br />
            ENGINEERED FOR DUTY
          </div>
        </div>
      </section>

      <footer id="contact" className="footer-section">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-[5.75vw] py-12 text-white/68 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <Image src="/images/zhaohui-logo-transparent.png" alt="ZHAOHUI 兆辉" width={112} height={42} />
            <p className="mt-5 text-sm leading-7">兆辉化工设备</p>
          </div>
          <nav aria-label="页脚导航" className="flex flex-wrap gap-x-7 gap-y-3 text-xs md:col-span-5">
            <a href="#equipment">核心设备</a>
            <a href="#projects">工程项目</a>
            <a href="#manufacturing">制造能力</a>
          </nav>
          <p className="text-xs md:col-span-2 md:text-right">© {new Date().getFullYear()} ZHAOHUI</p>
        </div>
      </footer>
    </main>
  );
}
