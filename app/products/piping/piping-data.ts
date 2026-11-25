// 管道与管件独立样片数据：钢衬四氟 / PO 管道及衬氟管件总装结构，严格遵循《防腐设备员工参阅手册》已确认口径。

export type PipingPieceId = "tee" | "lining" | "spool" | "elbow";

export interface PipingAssemblyStep {
  readonly id: PipingPieceId;
  readonly index: string;
  readonly title: string;
  readonly subtitle: string;
  readonly body: string;
  readonly confirm: readonly string[];
  readonly scrollRange: readonly [number, number];
}

export const pipingAssemblySteps: readonly PipingAssemblyStep[] = [
  {
    id: "tee",
    index: "01",
    title: "钢衬三通与支管接口",
    subtitle: "多向分流管件、支管法兰与连续翻边端面",
    body: "衬氟三通用于装置内介质分流、汇合及仪表支管引出；主管与支管内部衬里一次成型并在各法兰端面完整翻边，确保三通交汇处无焊缝死角与渗漏通道。",
    confirm: ["主管与支管公称直径 DN", "等径或异径三通形式", "现场支管朝向及法兰标准"],
    scrollRange: [0, 0.24],
  },
  {
    id: "lining",
    index: "02",
    title: "瓷白防腐衬管与法兰翻边",
    subtitle: "连续耐蚀内层与端面贴合翻边密封",
    body: "钢衬四氟或钢衬 PO 衬管紧密贴合于钢管内壁，并在每段法兰端面翻边形成平整密封面；装配时两段衬里端面直接压紧密封，将腐蚀性流体与外部钢壳彻底隔绝。",
    confirm: ["介质成分、浓度与杂质情况", "连续工作温度及最高波动温度", "是否存在负压抽吸工况"],
    scrollRange: [0.24, 0.5],
  },
  {
    id: "spool",
    index: "03",
    title: "承压直管段与连接法兰",
    subtitle: "钢制外管承压骨架与周向螺栓法兰",
    body: "外部钢管与法兰承担管路内压、管道自重及现场热胀应力，按装置轴测图定长预制直管段，到场后直接螺栓对中紧固，减少现场焊接对防腐层的热损伤。",
    confirm: ["单段管长与现场轴测图尺寸", "壳体材料类别与法兰连接方式", "运行压力与流量边界"],
    scrollRange: [0.5, 0.74],
  },
  {
    id: "elbow",
    index: "04",
    title: "90° 钢衬弯头与同心异径管",
    subtitle: "平滑转向管件与管径过渡衔接",
    body: "90° 钢衬弯头与同心/偏心异径管配合直管段完成空间转向与口径匹配，内壁过渡圆顺以降低冲刷阻力，并与各端面翻边共同构成连续耐蚀输送通道。",
    confirm: ["弯头角度与弯曲形式要求", "变径前后端公称直径 DN", "介质流速及是否含固相颗粒"],
    scrollRange: [0.74, 0.95],
  },
] as const;

import type { ProductPhotoItem } from "../product-gallery";

export const pipingCraftNotes = [
  {
    label: "产品范围",
    value: "涵盖钢衬四氟管道、钢衬 PO 管道及弯头、三通、异径管等衬氟管件，支持按装置轴测图非标定长配套。",
  },
  {
    label: "防腐工艺",
    value: "PTFE / PO 衬里工艺按公称直径、介质温度及是否涉及负压工况分别确定，不混用口径。",
  },
  {
    label: "高危介质",
    value: "涉及氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸等高危介质输送时，统一进入技术专项审核。",
  },
  {
    label: "出厂检验",
    value: "管段尺寸、衬里贴合度、法兰翻边端面平整度与出厂检验记录均按项目技术协议逐段核验。",
  },
] as const;

export const pipingGalleryPhotos: readonly ProductPhotoItem[] = [
  {
    id: "piping-ptfe",
    index: "01",
    tag: "钢衬四氟",
    title: "钢衬四氟管道与管件",
    caption: "按装置轴测图批量预制直管段、短节与三通管件，内壁白色四氟衬管于法兰端面连续翻边，到场直接螺栓紧固。",
    image: "/images/site/products/piping-ptfe.webp",
    imageAlt: "钢衬四氟管道与管件批量实拍，可见直管段、短节、三通及端面白色四氟翻边密封面",
  },
  {
    id: "piping-po",
    index: "02",
    tag: "钢衬 PO",
    title: "钢衬 PO 管道与三通管件",
    caption: "滚塑成型 PO 衬里在三通交汇处与法兰密封面连续过渡，兼顾管路耐蚀连续性与非标管件配套。",
    image: "/images/site/products/piping-po.webp",
    imageAlt: "钢衬 PO 管道与三通管件近景实拍，可见连续滚塑内衬与法兰端面翻边",
  },
] as const;
