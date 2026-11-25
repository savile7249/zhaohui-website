// 反应釜独立样片数据：立式钢衬夹套搅拌反应釜总装结构，严格遵循《防腐设备员工参阅手册》已确认口径。

export type ReactorPieceId = "drive" | "top" | "lining" | "shell" | "lower";

export interface ReactorAssemblyStep {
  readonly id: ReactorPieceId;
  readonly index: string;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly confirm: readonly string[];
  readonly scrollRange: readonly [number, number];
}

export const reactorAssemblySteps: readonly ReactorAssemblyStep[] = [
  {
    id: "drive",
    index: "01",
    title: "传动装置、轴封与搅拌系统",
    subtitle: "顶部电机减速机、轴封机架与防腐搅拌桨叶",
    body: "顶部传动与减速机通过机架与轴封座同轴安装于釜盖中心，带动耐蚀防腐搅拌轴与多层桨叶在釜内稳定运行，实现强腐蚀反应工况下的均匀混合与传质。",
    confirm: ["搅拌形式、转速区间与物料黏度", "轴封形式及工况密封要求", "防爆等级与现场供电条件"],
    scrollRange: [0, 0.2],
  },
  {
    id: "top",
    index: "02",
    title: "釜盖主法兰与工艺接管",
    subtitle: "可拆装椭圆釜盖、整周紧固法兰与顶口布置",
    body: "椭圆釜盖通过整周主法兰与釜体紧固，便于衬里成型、桨叶装拆与定期检验；釜盖周边按工艺方位布置进料、测温、测压、排气与检修接口，各管口均配连续翻边密封面。",
    confirm: ["工艺接管数量、管径与方位", "是否需要视镜、测温套管或加料人孔", "法兰标准及现场配管方向"],
    scrollRange: [0.2, 0.4],
  },
  {
    id: "lining",
    index: "03",
    title: "防腐衬里内胆与翻边密封",
    subtitle: "连续耐蚀内层、整壁贴合与法兰翻边面",
    body: "钢衬四氟、PFA、PO 或 PE 衬里紧贴于承压钢壳内壁，将腐蚀性反应介质与金属壳体完整隔离，并在主法兰与各工艺管口密封面处连续翻边，消除薄弱缝隙。",
    confirm: ["具体介质组分、浓度与反应过程变化", "连续与最高工作温度", "是否存在负压或温度急变工况"],
    scrollRange: [0.4, 0.62],
  },
  {
    id: "shell",
    index: "04",
    title: "承压釜体与传热夹套",
    subtitle: "外部结构骨架与夹套加热 / 冷却通道",
    body: "钢壳釜体承担反应压力、搅拌载荷与静液柱载荷；外侧按传热工艺配置夹套结构及冷热媒进出口，使传热介质在夹套腔内独立循环，与内部防腐衬里互不干涉。",
    confirm: ["壳体材料类别与结构形式", "釜内及夹套设计压力要求", "加热或冷却介质类型与温控方式"],
    scrollRange: [0.62, 0.8],
  },
  {
    id: "lower",
    index: "05",
    title: "釜底封头、放料口与支腿基础",
    subtitle: "椭圆底封头、侧向排液接口与四点刚性支承",
    body: "下椭圆封头平滑过渡至底侧法兰放料口，便于反应完成后快速排料与清洗；整釜落位于四根管式支腿与方形锚固底板上，为底部阀组与配管留出检修空间。",
    confirm: ["放料口管径、方位与放料阀衔接形式", "物料是否含固相、易结晶或高黏度", "支座形式（支腿、耳座或平台支承）"],
    scrollRange: [0.8, 0.96],
  },
] as const;

import type { ProductPhotoItem } from "../product-gallery";

export const reactorCraftNotes = [
  {
    label: "结构形式",
    value: "可按项目定制钢衬反应釜、钢衬四氟搅拌罐与双锥反应釜，并按传热与混合工艺配套夹套、盘管及搅拌轴封方案。",
  },
  {
    label: "防腐工艺",
    value: "板衬（PTFE / PFA）、滚塑（PE / PO）与喷涂工艺按反应介质、温度与负压工况分别评估，不混用口径。",
  },
  {
    label: "高危介质",
    value: "涉及氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等高危工况时，统一进入技术专项审核。",
  },
  {
    label: "出厂检验",
    value: "壳体与夹套成型、衬里连续性、搅拌同轴度及出厂检验项目均按项目技术协议执行并留存记录。",
  },
] as const;

export const reactorGalleryPhotos: readonly ProductPhotoItem[] = [
  {
    id: "reactor-ptfe",
    index: "01",
    tag: "板衬工艺",
    title: "钢衬四氟反应釜",
    caption: "釜盖按工艺方位集成多组进料、仪表与检修人孔法兰，外侧配刚性耳座，便于平台吊装与现场就位。",
    image: "/images/site/products/reactors-ptfe.webp",
    imageAlt: "钢衬四氟反应釜实拍，可见釜盖主法兰、多组工艺接管与耳座支承",
  },
  {
    id: "reactor-po",
    index: "02",
    tag: "滚塑工艺",
    title: "钢衬 PO 反应釜",
    caption: "配套顶部搅拌传动机架、大口径釜盖法兰与耳式支座，满足强腐蚀物料混合与反应工况需求。",
    image: "/images/site/products/reactors-po.webp",
    imageAlt: "钢衬 PO 反应釜实拍，可见搅拌传动装置、釜盖主法兰与耳座结构",
  },
  {
    id: "reactor-pfa",
    index: "03",
    tag: "板衬工艺",
    title: "钢衬 PFA 反应釜",
    caption: "不锈钢外筒配套顶置搅拌传动与大口径翻边观察口，内壁衬里延伸至法兰端面，配立式支腿底板。",
    image: "/images/site/products/reactors-pfa.webp",
    imageAlt: "钢衬 PFA 反应釜实拍，可见不锈钢外筒、顶置搅拌传动与大口径衬里翻边法兰口",
  },
] as const;
