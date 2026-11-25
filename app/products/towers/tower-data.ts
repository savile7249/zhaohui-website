// 塔器独立样片数据：基于真实填料洗涤塔总装结构编排，严格遵循《防腐设备员工参阅手册》已确认口径（不输出未审核参数）。

export type TowerPieceId = "top" | "sections" | "lining" | "lower" | "skirt";

export interface TowerAssemblyStep {
  readonly id: TowerPieceId;
  readonly index: string;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly confirm: readonly string[];
  readonly scrollRange: readonly [number, number];
}

export const towerAssemblySteps: readonly TowerAssemblyStep[] = [
  {
    id: "top",
    index: "01",
    title: "顶封头、出气弯管与除雾器",
    subtitle: "椭圆封头、顶部气相弯管与丝网除雾段",
    body: "顶部封头设气相出口弯管与吊耳，其下方配置丝网除雾器与钢衬支撑格栅，用于在气体离塔前截留夹带液滴，并保证顶部接口衬里连续密封。",
    confirm: ["气相出口管径与弯管方向", "除雾器形式及压降要求", "吊装条件与检修空间"],
    scrollRange: [0, 0.2],
  },
  {
    id: "sections",
    index: "02",
    title: "分段塔节与喷淋分布装置",
    subtitle: "多段法兰塔节、检修人孔与多层喷淋管",
    body: "塔体按工艺高度分为多段钢衬塔节，通过螺栓法兰对中紧固；塔内布置主管与多支管喷淋分布器，使循环液均匀覆盖下方填料截面，并配大口径检修人孔。",
    confirm: ["塔径、总高与分段数量", "喷淋层数、循环量与喷嘴形式", "人孔及检修平台方位"],
    scrollRange: [0.2, 0.4],
  },
  {
    id: "lining",
    index: "03",
    title: "填料层、钢衬压板与衬里翻边",
    subtitle: "连续防腐内层与上下多孔支承压紧结构",
    body: "填料层上下分别设钢衬支承孔板与钢衬压板，防止气流冲击导致填料移位；钢衬四氟 / PO / PE 衬里在各塔节法兰处翻边密封，将腐蚀性介质与钢壳彻底隔离。",
    confirm: ["介质组分、浓度与工作温度", "填料类型、层高与防腐工艺路线", "是否存在负压或温度骤变"],
    scrollRange: [0.4, 0.62],
  },
  {
    id: "lower",
    index: "04",
    title: "下塔节、进气口与仪表接管",
    subtitle: "储液段壳体、侧向进气及在线监测接口",
    body: "下段塔节承担底部储液与气相引入功能，按工艺方位布置大口径进气口、上下液位计口、仪表测温/监测口，以及带回转臂的底部检修人孔。",
    confirm: ["废气组成、浓度、湿度与处理量", "液位、测温等仪表接口清单", "进出液及现场配管方位"],
    scrollRange: [0.62, 0.8],
  },
  {
    id: "skirt",
    index: "05",
    title: "平底基础环与整塔就位",
    subtitle: "整塔承载底板与现场基础锚固",
    body: "三段塔节与内部件自上而下合拢后，整体落位于圆形平底基础环上，通过地脚螺栓与现场基础稳固连接，承担整塔自重及运行液柱载荷。",
    confirm: ["基础承载与地脚螺栓布置", "设备运行满水载荷边界", "运输限高与现场吊装条件"],
    scrollRange: [0.8, 0.96],
  },
] as const;

import type { ProductPhotoItem } from "../product-gallery";

export const towerCraftNotes = [
  {
    label: "结构形式",
    value: "可按项目采用整体式或分段式衬氟塔节，配套除雾、喷淋分布与填料支承等塔内件，适配吸收、洗涤、脱硫与精馏等工艺段。",
  },
  {
    label: "防腐工艺",
    value: "板衬（PTFE / PFA / PVDF）、滚塑（PE / PO）与喷涂工艺按实际介质与温度条件分别确定，不混用口径。",
  },
  {
    label: "高危介质",
    value: "涉及氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等高危工况时，统一进入技术专项审核。",
  },
  {
    label: "出厂检验",
    value: "壳体制造、衬里成型、管口翻边与出厂检验项目，均按项目技术协议逐项执行并留存记录。",
  },
] as const;

export const towerGalleryPhotos: readonly ProductPhotoItem[] = [
  {
    id: "tower-exterior",
    index: "01",
    tag: "整塔外观",
    title: "衬氟塔器整塔外观",
    caption: "分段塔节配多组检修人孔、侧向工艺接管与端部承压法兰，按项目分段要求完成总装出厂。",
    image: "/images/site/products/towers-exterior.webp",
    imageAlt: "衬氟塔器整塔外观实拍，可见多组检修人孔、侧向法兰接管与整塔壳体",
  },
  {
    id: "tower-spray",
    index: "02",
    tag: "内部构造",
    title: "衬氟塔器内部喷淋视角",
    caption: "筒体内壁连续衬氟并完整翻边至端面法兰，内部配套耐蚀喷淋分布管路与支承结构。",
    image: "/images/site/products/towers-spray.webp",
    imageAlt: "衬氟塔器内部喷淋视角实拍，可见白色防腐衬里、法兰翻边与内部喷淋分布管",
  },
  {
    id: "tower-grid",
    index: "03",
    tag: "内部构造",
    title: "衬氟塔器内部栅板视角",
    caption: "大口径塔节端面配置格栅支承结构，兼顾填料层承载与气液通流截面，外部按工艺方位留设接管。",
    image: "/images/site/products/towers-grid.webp",
    imageAlt: "衬氟塔器内部栅板视角实拍，可见塔节端面格栅支承结构与筒体侧接管",
  },
] as const;
