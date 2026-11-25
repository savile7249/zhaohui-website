// 储罐独立样片数据：立式钢衬防腐储罐总装结构，严格遵循《防腐设备员工参阅手册》已确认口径。

export type TankPieceId = "top" | "lining" | "shell" | "lower" | "legs";

export interface TankAssemblyStep {
  readonly id: TankPieceId;
  readonly index: string;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly confirm: readonly string[];
  readonly scrollRange: readonly [number, number];
}

export const tankAssemblySteps: readonly TankAssemblyStep[] = [
  {
    id: "top",
    index: "01",
    title: "顶封头、大法兰与顶部接管",
    subtitle: "可拆装椭圆顶盖、周向螺栓法兰与顶口布置",
    body: "顶部椭圆封头通过整周主法兰与筒体紧固，便于衬里成型、检修与检验；顶盖上按工艺方位均布进料、液位、压力及备用接管，并配套吊耳。",
    confirm: ["立式或卧式结构与开盖形式", "顶部接口数量、公称直径与方位", "法兰标准及现场配管方向"],
    scrollRange: [0, 0.2],
  },
  {
    id: "lining",
    index: "02",
    title: "防腐衬里内胆与翻边密封",
    subtitle: "连续耐蚀内层、整壁贴合与法兰翻边面",
    body: "钢衬四氟、PFA、PVDF、PE 或 PO 衬里紧密贴合于钢壳内壁，构成隔绝腐蚀性介质的连续屏障，并在主法兰与各管口密封面处完整翻边，阻断介质渗入钢壳。",
    confirm: ["具体介质、浓度与杂质情况", "连续与最高工作温度", "板衬、滚塑或喷涂工艺路线"],
    scrollRange: [0.2, 0.44],
  },
  {
    id: "shell",
    index: "03",
    title: "承压钢壳筒体与主法兰",
    subtitle: "外部结构骨架、筒体卷制与整周紧固",
    body: "钢壳筒体与主法兰构成储罐的外部承压骨架，承担满液静压载荷、运行压力与接管受力，为内部防腐衬里提供稳定的刚性支撑与密闭封装。",
    confirm: ["壳体材料类别（碳钢 / 不锈钢 / 玻璃钢）", "设计压力与是否涉及负压", "是否需要保温或现场液位观察结构"],
    scrollRange: [0.44, 0.66],
  },
  {
    id: "lower",
    index: "04",
    title: "下封头与侧出料口",
    subtitle: "椭圆底封头与底侧法兰排液接口",
    body: "下椭圆封头与筒体平滑过渡，下段侧向配置带翻边密封面的法兰出料口，便于与现场管道及排液阀组直接衔接，并兼顾槽底排净与定期冲洗维护。",
    confirm: ["侧出料口管径、方位与阀门衔接方式", "介质是否易结晶、沉积或含固相", "排净与清洗工艺要求"],
    scrollRange: [0.66, 0.82],
  },
  {
    id: "legs",
    index: "05",
    title: "管式支腿与基础底板",
    subtitle: "四点均布支撑与现场基础锚固",
    body: "罐体落位于周向均布的四根管式支腿与方形锚固底板上，既稳固承担满液载荷，又在罐底留出充足高度以布置出料管道与阀门检修空间。",
    confirm: ["基础承载条件与地脚螺栓布置", "罐底离地净空与下方配管高度", "支座形式（支腿、耳座或鞍座）"],
    scrollRange: [0.82, 0.96],
  },
] as const;

import type { ProductPhotoItem } from "../product-gallery";

export const tankCraftNotes = [
  {
    label: "结构形式",
    value: "可按项目定制立式或卧式防腐储罐，支撑方式按容积与现场布置选用管式支腿、耳座、裙座或鞍座。",
  },
  {
    label: "防腐工艺",
    value: "板衬（PTFE / PFA / PVDF）、滚塑（PE / PO）与喷涂工艺按介质、浓度与温度分别评估，不混用口径。",
  },
  {
    label: "高危介质",
    value: "涉及氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等高危工况时，统一进入技术专项审核。",
  },
  {
    label: "出厂检验",
    value: "壳体成型、衬里连续性、管口翻边与检验判定标准均按项目技术协议执行并留存记录。",
  },
] as const;

export const tankGalleryPhotos: readonly ProductPhotoItem[] = [
  {
    id: "tank-ptfe",
    index: "01",
    tag: "板衬工艺",
    title: "钢衬四氟储罐",
    caption: "承压钢壳内壁贴合白色聚四氟乙烯衬里，端面大口法兰完整翻边密封，阻隔腐蚀性介质接触金属壳体。",
    image: "/images/site/products/tanks-ptfe.webp",
    imageAlt: "钢衬四氟储罐实拍，可见内部白色 PTFE 衬里内腔与主法兰翻边密封面",
  },
  {
    id: "tank-po",
    index: "02",
    tag: "滚塑工艺",
    title: "钢衬 PO 储罐",
    caption: "整体滚塑成型 PO 衬里紧贴钢壳内壁，内表面连续无焊缝死角，适用于耐腐蚀介质储存与缓冲。",
    image: "/images/site/products/tanks-po.webp",
    imageAlt: "钢衬 PO 储罐实拍，可见滚塑成型内衬层与承压钢壳筒体",
  },
  {
    id: "tank-pe",
    index: "03",
    tag: "滚塑工艺",
    title: "钢衬 PE 储罐",
    caption: "内部 PE 滚塑衬里延伸至法兰密封面，兼顾外钢壳结构强度与内表面整体连续防腐需求。",
    image: "/images/site/products/tanks-pe.webp",
    imageAlt: "钢衬 PE 储罐实拍，可见内部白色 PE 衬里与整周翻边密封面",
  },
  {
    id: "tank-pfa",
    index: "04",
    tag: "板衬工艺",
    title: "钢衬 PFA 储罐",
    caption: "立式结构配多点管式支腿与基础底板，按项目容积与接口方位定制顶部与侧向法兰接管。",
    image: "/images/site/products/tanks-pfa.webp",
    imageAlt: "钢衬 PFA 储罐实拍，可见立式储罐外观与管式支腿结构",
  },
  {
    id: "tank-pvdf",
    index: "05",
    tag: "板衬工艺",
    title: "钢衬 PVDF 储罐",
    caption: "立式筒体配顶盖主法兰与上下侧向接管，便于现场配管衔接与内部检修维护。",
    image: "/images/site/products/tanks-pvdf.webp",
    imageAlt: "钢衬 PVDF 储罐实拍，可见立式筒体、顶部法兰与侧向接管布置",
  },
] as const;
