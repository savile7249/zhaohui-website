// 内容口径以《防腐设备员工参阅手册》为准：
// - 只使用"已确认"条目；喷涂具体材料、壳体牌号等"待确认"条目不对外展示。
// - 不输出耐温、压力、寿命、价格等未经审核的参数。

export interface HeroMetric {
  value: string;
  unit: string;
  label: string;
}

// 首屏文案：主标题与导语保持合规口径；交付规模与周期指标及底部 slogan 按客户确认内容展示。
export const heroContent = {
  headingLines: ["专做化工防腐设备", "酸碱溶剂各有解法"],
  leadLines: [
    "主营储罐、反应釜、塔器与管道，配套板衬、滚塑与喷涂。",
    "金属或玻璃钢壳体承压，高分子衬里防腐，按工况分层选材。",
  ],
  metrics: [
    { value: "1000+", unit: "套", label: "防腐设备年交付量" },
    { value: "20", unit: "年", label: "工业防腐领域经验" },
    { value: "2", unit: "天", label: "定制方案出图" },
    { value: "1", unit: "月", label: "成品交付周期" },
  ] as readonly HeroMetric[],
  slogan: "让设备，经得住现场",
} as const;

export interface CutawayLayer {
  id: "shell" | "interface" | "lining" | "flange";
  index: string;
  title: string;
  summary: string;
  facts: readonly string[];
  confirm: readonly string[];
}

export const cutawayLayers: readonly CutawayLayer[] = [
  {
    id: "shell",
    index: "1",
    title: "壳体",
    summary: "承担运行压力、设备自重、支座与接管受力。壳体提供结构强度，但不替代防腐层。",
    facts: ["碳钢", "不锈钢", "玻璃钢（FRP）"],
    confirm: ["材料牌号与板厚", "设计标准", "接管开孔与法兰形式"],
  },
  {
    id: "interface",
    index: "2",
    title: "结合层",
    summary: "衬里与壳体之间的结合方式。负压和温度变化时，衬里能否保持贴合，主要取决于这一层。",
    facts: ["板衬：固定或焊接方式按设计确定", "滚塑：与壳体一体成型", "喷涂：取决于表面处理与附着"],
    confirm: ["是否存在负压", "温度波动范围", "转角、焊缝处的过渡"],
  },
  {
    id: "lining",
    index: "3",
    title: "防腐衬里",
    summary: "直接接触介质的连续屏障。板衬、滚塑、喷涂是三条不同的工艺路线，材料与适用条件不能混用。",
    facts: ["板衬：PTFE / PFA / PVDF", "滚塑：PE / PO", "喷涂：涂层材料按工况审核"],
    confirm: ["介质与浓度", "工作温度", "杂质与清洗要求"],
  },
  {
    id: "flange",
    index: "4",
    title: "管口翻边",
    summary: "管口、人孔与法兰密封面是衬里连续性最容易中断的位置，需要单独处理和检查。",
    facts: ["衬里在管口处翻边至密封面", "标准与非标法兰均可配套"],
    confirm: ["接口数量与尺寸", "法兰标准", "现场配管方向"],
  },
] as const;

export interface LiningProcess {
  id: "sheet" | "roto" | "coating";
  name: string;
  materials: string;
  trait: string;
  confirm: string;
}

export const liningProcesses: readonly LiningProcess[] = [
  {
    id: "sheet",
    name: "板衬",
    materials: "PTFE / PFA / PVDF",
    trait: "氟塑料板材贴合、焊接成型，管口可翻边密封。",
    confirm: "板材规格与厚度、固定或焊接方式、温度、是否负压",
  },
  {
    id: "roto",
    name: "滚塑",
    materials: "PE / PO",
    trait: "整体滚塑成型，内表面连续。",
    confirm: "材料牌号、衬里厚度、温度、设备尺寸与运输限制",
  },
  {
    id: "coating",
    name: "喷涂",
    materials: "按工况审核",
    trait: "喷涂是防腐工艺，不是独立产品。",
    confirm: "涂层材料、膜厚、表面处理、固化条件",
  },
] as const;

export interface CompanyMilestone {
  value: string;
  unit?: string;
  title: string;
  body: string;
}

export interface PartnerLogoItem {
  id: string;
  name: string;
  logo: string;
  ring: 1 | 2 | 3;
}

// 摘自《江苏兆辉防腐科技企业画册》企业介绍页，保留核实的时间节点、产能规模与工艺设施事实。
export const aboutCompanyProfile = {
  lead: "江苏兆辉防腐科技有限公司始于 2009 年 7 月，专业从事防腐设备、环保设备、各类非标设备及其配件的设计制造。公司配备滚塑、衬氟、钢罐体制作及检验检测设备，由经验丰富的工艺与技术团队承担制造与品控。",
  summary:
    "从江苏 1.5 万平方米标准化厂房、G4 洁净生产车间，到占地 30 余亩的安徽兆辉智能装备与自建石墨厂区，兆辉正从单一设备向成套系统化方案持续延伸。",
  wallCenterTitle: "兆辉智能装备",
  wallCenterSlogan: "陪伴与成就商业新领袖",
} as const;

export const companyMilestones: readonly CompanyMilestone[] = [
  {
    value: "2009",
    unit: "年",
    title: "标准化生产体系建成",
    body: "始于 2009 年 7 月；2020 年 5 月正式入驻占地 1.5 万平方米的标准化厂房，配套独立衬四氟车间、冷作车间、喷涂车间、喷砂房与滚塑车间。",
  },
  {
    value: "2022",
    unit: "年",
    title: "G4 洁净车间与品控升级",
    body: "完成喷涂车间扩建优化，新增独立主炉与标准化喷砂房，建成 G4 洁净生产车间；同步引进自动焊接设备与精密检测仪器。",
  },
  {
    value: "2024",
    unit: "年",
    title: "安徽分厂正式落成",
    body: "2024 年 6 月，安徽兆辉智能装备有限公司落成，占地 30 余亩，进一步拓宽生产基地与智能装备制造布局。",
  },
  {
    value: "持续拓局",
    title: "石墨厂区与成套系统",
    body: "现已自建石墨生产厂区，并规划进一步扩大产业规模，从单一设备制造逐步向成套系统化整体解决方案延伸。",
  },
] as const;

// 合作企业与科研院所透明底 Logo（收录自展厅企业合作客户墙，暂略 2 枚非透明底素材：02-07 莱特光电、03-03 中国极地研究中心），
// 按内/中/外三条同心半圆轨道排布（10 + 13 + 17 = 40）。
export const partnerLogos: readonly PartnerLogoItem[] = [
  // 内环（10 家）
  { id: "03-01", name: "乐叶光伏", logo: "/images/site/partners/partner-03-01.webp", ring: 1 },
  { id: "03-02", name: "华友钴业", logo: "/images/site/partners/partner-03-02.webp", ring: 1 },
  { id: "03-04", name: "威远生化", logo: "/images/site/partners/partner-03-04.webp", ring: 1 },
  { id: "03-05", name: "上海华谊", logo: "/images/site/partners/partner-03-05.webp", ring: 1 },
  { id: "03-06", name: "贝特瑞", logo: "/images/site/partners/partner-03-06.webp", ring: 1 },
  { id: "04-01", name: "利而安化工", logo: "/images/site/partners/partner-04-01.webp", ring: 1 },
  { id: "04-02", name: "石药集团", logo: "/images/site/partners/partner-04-02.webp", ring: 1 },
  { id: "04-03", name: "中天新能源", logo: "/images/site/partners/partner-04-03.webp", ring: 1 },
  { id: "04-04", name: "石大胜华", logo: "/images/site/partners/partner-04-04.webp", ring: 1 },
  { id: "04-05", name: "金岭集团", logo: "/images/site/partners/partner-04-05.webp", ring: 1 },

  // 中环（13 家）
  { id: "02-01", name: "天赐", logo: "/images/site/partners/partner-02-01.webp", ring: 2 },
  { id: "02-02", name: "Brother", logo: "/images/site/partners/partner-02-02.webp", ring: 2 },
  { id: "02-03", name: "章源钨业", logo: "/images/site/partners/partner-02-03.webp", ring: 2 },
  { id: "02-04", name: "中盐集团", logo: "/images/site/partners/partner-02-04.webp", ring: 2 },
  { id: "02-05", name: "湖南恒光科技", logo: "/images/site/partners/partner-02-05.webp", ring: 2 },
  { id: "02-06", name: "中国五矿", logo: "/images/site/partners/partner-02-06.webp", ring: 2 },
  { id: "05-01", name: "中国平煤神马集团", logo: "/images/site/partners/partner-05-01.webp", ring: 2 },
  { id: "05-02", name: "合盛硅业", logo: "/images/site/partners/partner-05-02.webp", ring: 2 },
  { id: "05-03", name: "湖北宜化", logo: "/images/site/partners/partner-05-03.webp", ring: 2 },
  { id: "05-04", name: "紫金矿业", logo: "/images/site/partners/partner-05-04.webp", ring: 2 },
  { id: "05-05", name: "隆基绿能", logo: "/images/site/partners/partner-05-05.webp", ring: 2 },
  { id: "05-06", name: "红星化工", logo: "/images/site/partners/partner-05-06.webp", ring: 2 },
  { id: "05-07", name: "菲达环保", logo: "/images/site/partners/partner-05-07.webp", ring: 2 },

  // 外环（17 家）
  { id: "01-01", name: "安瑞森", logo: "/images/site/partners/partner-01-01.webp", ring: 3 },
  { id: "01-02", name: "宝晟得药业", logo: "/images/site/partners/partner-01-02.webp", ring: 3 },
  { id: "01-03", name: "滨化集团", logo: "/images/site/partners/partner-01-03.webp", ring: 3 },
  { id: "01-04", name: "东开科技", logo: "/images/site/partners/partner-01-04.webp", ring: 3 },
  { id: "01-05", name: "华新建材", logo: "/images/site/partners/partner-01-05.webp", ring: 3 },
  { id: "01-06", name: "龙氟新材料", logo: "/images/site/partners/partner-01-06.webp", ring: 3 },
  { id: "01-07", name: "潞安化工集团", logo: "/images/site/partners/partner-01-07.webp", ring: 3 },
  { id: "03-07", name: "星云股份", logo: "/images/site/partners/partner-03-07.webp", ring: 3 },
  { id: "04-06", name: "厦门钨业", logo: "/images/site/partners/partner-04-06.webp", ring: 3 },
  { id: "04-07", name: "海洋化工研究院", logo: "/images/site/partners/partner-04-07.webp", ring: 3 },
  { id: "06-01", name: "正帆科技", logo: "/images/site/partners/partner-06-01.webp", ring: 3 },
  { id: "06-02", name: "常州新东化工", logo: "/images/site/partners/partner-06-02.webp", ring: 3 },
  { id: "06-03", name: "金浦投资控股集团", logo: "/images/site/partners/partner-06-03.webp", ring: 3 },
  { id: "06-04", name: "圣泉集团", logo: "/images/site/partners/partner-06-04.webp", ring: 3 },
  { id: "06-05", name: "西安三浦", logo: "/images/site/partners/partner-06-05.webp", ring: 3 },
  { id: "06-06", name: "通威集团", logo: "/images/site/partners/partner-06-06.webp", ring: 3 },
  { id: "06-07", name: "苏州晶协", logo: "/images/site/partners/partner-06-07.webp", ring: 3 },
] as const;

export const principles = [
  {
    title: "先问介质，再谈材料",
    body: "不凭“强酸”“强碱”这类笼统说法选材。先确认具体介质、浓度、温度与杂质，再讨论衬里方案。",
  },
  {
    title: "工艺分开讲清楚",
    body: "板衬、滚塑、喷涂各有边界。我们不混用工艺名称，也不把一种工艺的经验套到另一种上。",
  },
  {
    title: "不做没有依据的承诺",
    body: "耐温、压力、寿命等参数，在没有审核依据前不对外承诺。高危介质一律进入专项审核。",
  },
] as const;

export const manufacturingSteps = [
  {
    step: "01",
    title: "工况与图纸审核",
    detail: "下料前核对介质组分、浓度、温度与压力（含是否负压）。氢氟酸、混酸等高危介质进入专项审核。",
  },
  {
    step: "02",
    title: "壳体制造",
    detail: "按图纸完成壳体成型、焊接与接管开孔，并对内表面做衬里前处理。",
  },
  {
    step: "03",
    title: "衬里成型",
    detail: "板衬、滚塑、喷涂分别按各自的工艺要求控制，不混用工艺口径。",
  },
  {
    step: "04",
    title: "接口处理",
    detail: "管口翻边、法兰密封面、人孔等部位单独处理与检查。",
  },
  {
    step: "05",
    title: "出厂检验",
    detail: "检验项目与判定标准按项目技术协议执行，并留存检验记录。",
  },
] as const;

export interface MediumRiskOption {
  id: string;
  tier: string;
  label: string;
  examples: string;
  note: string;
  extraInputs: readonly string[];
}

export const mediumRiskOptions: readonly MediumRiskOption[] = [
  {
    id: "special",
    tier: "专项审核",
    label: "高危、强氧化或混合介质",
    examples: "如氢氟酸、高氯酸、氯磺酸、液溴、过氧化氢、混酸",
    note: "此类介质由技术负责人专项审核，页面不给出选材结论。沟通时请附完整组分、浓度、温度、杂质报告及 SDS。",
    extraInputs: ["SDS 安全技术说明书", "完整组分与浓度", "杂质、水分、金属离子报告"],
  },
  {
    id: "acid",
    tier: "技术审核",
    label: "无机酸碱、含氯或高盐废水",
    examples: "如氢氧化钠、磷酸、次氯酸钠、含氯废水",
    note: "需要结合浓度、温度、结晶或固含量判断，不能只凭“强酸”“强碱”定材。",
    extraInputs: ["工作浓度范围", "最高与正常温度", "结晶、固含量或游离氯"],
  },
  {
    id: "solvent",
    tier: "技术审核",
    label: "有机溶剂",
    examples: "如甲醇、乙酸乙酯、四氢呋喃、二氯乙烷",
    note: "有机溶剂不能套用酸碱经验，需确认纯度、含水量、防爆要求及渗透、溶胀风险。",
    extraInputs: ["纯度与含水量", "防爆区域等级", "是否伴热"],
  },
] as const;

export const shellMaterialOptions = ["碳钢", "不锈钢", "玻璃钢（FRP）", "待沟通"] as const;

export const liningProcessOptions = ["板衬", "滚塑", "喷涂", "待评估"] as const;

export const volumePresets = ["10 m³", "20 m³", "50 m³", "100 m³", "其他"] as const;

export interface SiteGalleryItem {
  image: string;
  imageAlt: string;
  label: string;
  caption: string;
}

export const manufacturingGallery: readonly SiteGalleryItem[] = [
  {
    image: "/images/site/site-shell-workshop.webp",
    imageAlt: "冷作车间内正在组对加工的钢制筒体与设备壳体",
    label: "冷作车间",
    caption: "钢制筒体卷圆、组对与壳体焊接。",
  },
  {
    image: "/images/site/site-cnc-cutting.webp",
    imageAlt: "车间内数控切割机正在加工钢板开孔件",
    label: "数控下料",
    caption: "钢板、管板与接口结构件数控切割下料。",
  },
  {
    image: "/images/site/site-factory-aerial.webp",
    imageAlt: "安徽兆辉标准化生产基地航拍实景",
    label: "生产基地",
    caption: "安徽兆辉标准化厂房与分区作业车间。",
  },
] as const;

export interface IndustryItem {
  index: string;
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
}

export const industryApplications: readonly IndustryItem[] = [
  {
    index: "01",
    title: "化工",
    summary: "腐蚀性介质储存、反应与工艺管路衔接，材料与衬里工艺按实际工况核定。",
    image: "/images/site/industries/chemical.webp",
    imageAlt: "现代化工园区与装置全景",
  },
  {
    index: "02",
    title: "光伏储能",
    summary: "湿法工艺、酸碱辅助及电解液储运环节的防腐储罐、反应单元与配套管件。",
    image: "/images/site/industries/pv-storage.webp",
    imageAlt: "光伏电站与储能系统现场",
  },
  {
    index: "03",
    title: "海水淡化",
    summary: "高盐水体、浓盐水及加药系统的防腐储存与输送设备。",
    image: "/images/site/industries/desalination.webp",
    imageAlt: "海水淡化与水处理排水管道现场",
  },
  {
    index: "04",
    title: "电力",
    summary: "脱硫、水处理及酸碱再生系统的衬里储罐、塔器与工艺管段。",
    image: "/images/site/industries/power.webp",
    imageAlt: "电力变电与能源设施现场",
  },
  {
    index: "05",
    title: "食品加工",
    summary: "清洗剂、酸碱辅助介质储运及工艺配套设备的防腐需求。",
    image: "/images/site/industries/food.webp",
    imageAlt: "食品加工自动化生产线现场",
  },
] as const;

export interface CertificateItem {
  id: string;
  group: "qualification" | "honor";
  groupLabel: string;
  title: string;
  code: string;
  note: string;
  image: string;
}

export const certificateItems: readonly CertificateItem[] = [
  {
    id: "license-tank",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "全国工业产品生产许可证（危险化学品罐体）",
    code: "（苏）XK12-002-00004",
    note: "江苏省市场监督管理局颁发，涵盖危险化学品罐体生产许可。",
    image: "/images/site/certs/license-tank.webp",
  },
  {
    id: "high-tech",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "高新技术企业证书",
    code: "GR202032009635",
    note: "江苏省科学技术厅、财政厅、税务局联合认定（历史存档件，最新复审件可按需核验）。",
    image: "/images/site/certs/high-tech.webp",
  },
  {
    id: "iso-9001",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "质量管理体系认证（ISO 9001）",
    code: "GB/T 19001-2016 / ISO 9001:2015",
    note: "覆盖防腐设备用钢衬塑管道、钢塑塔器、钢衬复合罐及搅拌罐生产（最新换证原件可按需提供）。",
    image: "/images/site/certs/iso-9001.webp",
  },
  {
    id: "iso-14001",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "环境管理体系认证（ISO 14001）",
    code: "GB/T 24001-2016 / ISO 14001:2015",
    note: "覆盖钢衬塑管道、塔器、复合罐与搅拌罐生产及相关环境管理活动（最新换证原件可按需提供）。",
    image: "/images/site/certs/iso-14001.webp",
  },
  {
    id: "iso-45001",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "职业健康安全管理体系认证（ISO 45001）",
    code: "GB/T 45001-2020 / ISO 45001:2018",
    note: "覆盖防腐设备制造及职业健康安全管理活动（最新换证原件可按需提供）。",
    image: "/images/site/certs/iso-45001.webp",
  },
  {
    id: "ce-fluoro",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "欧盟 CE 认证（氟塑料衬里设备）",
    code: "EN ISO 12100:2010 · 2006/42/EC",
    note: "覆盖钢衬氟塑料储罐、塔器、搅拌器及管道（存档样本，出口项目按最新合规要求核验）。",
    image: "/images/site/certs/ce-fluoro.webp",
  },
  {
    id: "ce-plastic",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "欧盟 CE 认证（工程塑料衬里设备）",
    code: "EN ISO 12100:2010 · 2006/42/EC",
    note: "覆盖钢衬塑储罐、塔器、搅拌器及管道（存档样本，出口项目按最新合规要求核验）。",
    image: "/images/site/certs/ce-plastic.webp",
  },
  {
    id: "trademark",
    group: "qualification",
    groupLabel: "行政许可与体系",
    title: "ZHAOHUI 商标注册证",
    code: "第 14449432 号",
    note: "江苏兆辉防腐科技有限公司注册品牌标识。",
    image: "/images/site/certs/trademark.webp",
  },
  {
    id: "aaa-credit",
    group: "honor",
    groupLabel: "信用与荣誉",
    title: "AAA 级企业信用等级证书",
    code: "Q/HRXY100-2019",
    note: "企业信用等级评价历史存档件。",
    image: "/images/site/certs/aaa-credit.webp",
  },
  {
    id: "aaa-contract",
    group: "honor",
    groupLabel: "信用与荣誉",
    title: "AAA 级重合同守信用企业",
    code: "Q/HRXY100-2019",
    note: "重合同守信用评价历史存档件。",
    image: "/images/site/certs/aaa-contract.webp",
  },
  {
    id: "aaa-quality",
    group: "honor",
    groupLabel: "信用与荣誉",
    title: "AAA 级质量服务信誉证书",
    code: "Q/HRXY100-2019",
    note: "质量服务信誉评价历史存档件。",
    image: "/images/site/certs/aaa-quality.webp",
  },
  {
    id: "aaa-integrity",
    group: "honor",
    groupLabel: "信用与荣誉",
    title: "AAA 级诚信经营示范单位",
    code: "Q/HRXY100-2019",
    note: "诚信经营示范评价历史存档件。",
    image: "/images/site/certs/aaa-integrity.webp",
  },
] as const;

export interface PatentItem {
  id: string;
  type: "发明专利" | "实用新型";
  title: string;
  number: string;
  image: string;
}

export const patentWallImage = {
  image: "/images/site/patents/patent-wall.webp",
  title: "企业专利证书墙实拍",
  caption: "办公展厅内陈列的授权专利证书原件。",
} as const;

export const patentItems: readonly PatentItem[] = [
  {
    id: "zl201010191114-0",
    type: "发明专利",
    title: "具有改性聚丙烯内衬层的钢滚塑储罐的制造方法",
    number: "ZL 2010 1 0191114.0",
    image: "/images/site/patents/zl201010191114-0.webp",
  },
  {
    id: "zl201010191132-9",
    type: "发明专利",
    title: "具有改性聚丙烯内衬层的钢滚塑管道的制造方法",
    number: "ZL 2010 1 0191132.9",
    image: "/images/site/patents/zl201010191132-9.webp",
  },
  {
    id: "zl201010191115-5",
    type: "发明专利",
    title: "具有聚烯烃内衬层的钢滚塑管道的制造方法",
    number: "ZL 2010 1 0191115.5",
    image: "/images/site/patents/zl201010191115-5.webp",
  },
  {
    id: "zl202422502856-0",
    type: "实用新型",
    title: "一种钢衬聚四氟乙烯耐高温储罐",
    number: "ZL 2024 2 2502856.0",
    image: "/images/site/patents/zl202422502856-0.webp",
  },
  {
    id: "zl202320252421-8",
    type: "实用新型",
    title: "一种方便拆装的钢衬四氟管",
    number: "ZL 2023 2 0252421.8",
    image: "/images/site/patents/zl202320252421-8.webp",
  },
  {
    id: "zl202223222447-2",
    type: "实用新型",
    title: "一种钢衬PFA储罐清洁装置",
    number: "ZL 2022 2 3222447.2",
    image: "/images/site/patents/zl202223222447-2.webp",
  },
  {
    id: "zl202223028209-8",
    type: "实用新型",
    title: "一种钢衬PFA搅拌罐",
    number: "ZL 2022 2 3028209.8",
    image: "/images/site/patents/zl202223028209-8.webp",
  },
  {
    id: "zl202222766528-2",
    type: "实用新型",
    title: "一种钢衬PFA储罐",
    number: "ZL 2022 2 2766528.2",
    image: "/images/site/patents/zl202222766528-2.webp",
  },
  {
    id: "zl202220802046-5",
    type: "实用新型",
    title: "一种高度可调的钢衬PTFE储罐",
    number: "ZL 2022 2 0802046.5",
    image: "/images/site/patents/zl202220802046-5.webp",
  },
  {
    id: "zl202123226937-5",
    type: "实用新型",
    title: "一种便于拆装的钢衬PTFE储罐",
    number: "ZL 2021 2 3226937.5",
    image: "/images/site/patents/zl202123226937-5.webp",
  },
  {
    id: "zl201921094287-3",
    type: "实用新型",
    title: "一种耐负压钢衬PTFE储罐",
    number: "ZL 2019 2 1094287.3",
    image: "/images/site/patents/zl201921094287-3.webp",
  },
  {
    id: "zl201921094286-9",
    type: "实用新型",
    title: "一种钢衬PTFE塔器",
    number: "ZL 2019 2 1094286.9",
    image: "/images/site/patents/zl201921094286-9.webp",
  },
  {
    id: "zl201921094284-x",
    type: "实用新型",
    title: "一种钢衬PFA储罐",
    number: "ZL 2019 2 1094284.X",
    image: "/images/site/patents/zl201921094284-x.webp",
  },
  {
    id: "zl201921094282-0",
    type: "实用新型",
    title: "一种耐高温钢衬PTFE储罐",
    number: "ZL 2019 2 1094282.0",
    image: "/images/site/patents/zl201921094282-0.webp",
  },
  {
    id: "zl201921094281-6",
    type: "实用新型",
    title: "一种耐高温钢衬PTFE搅拌罐",
    number: "ZL 2019 2 1094281.6",
    image: "/images/site/patents/zl201921094281-6.webp",
  },
  {
    id: "zl201921094280-1",
    type: "实用新型",
    title: "一种钢衬PFA搅拌罐",
    number: "ZL 2019 2 1094280.1",
    image: "/images/site/patents/zl201921094280-1.webp",
  },
  {
    id: "zl201921094279-9",
    type: "实用新型",
    title: "一种钢衬PTFE半导体储罐",
    number: "ZL 2019 2 1094279.9",
    image: "/images/site/patents/zl201921094279-9.webp",
  },
  {
    id: "zl201921094278-4",
    type: "实用新型",
    title: "一种钢衬PTFE半导体级搅拌罐",
    number: "ZL 2019 2 1094278.4",
    image: "/images/site/patents/zl201921094278-4.webp",
  },
  {
    id: "zl201921094275-0",
    type: "实用新型",
    title: "一种钢衬PTFE电子级搅拌罐",
    number: "ZL 2019 2 1094275.0",
    image: "/images/site/patents/zl201921094275-0.webp",
  },
  {
    id: "zl201921094274-6",
    type: "实用新型",
    title: "一种钢衬PTFE电子级储罐",
    number: "ZL 2019 2 1094274.6",
    image: "/images/site/patents/zl201921094274-6.webp",
  },
  {
    id: "zl201821282067-9",
    type: "实用新型",
    title: "一种钢衬四氟乙烯储罐",
    number: "ZL 2018 2 1282067.9",
    image: "/images/site/patents/zl201821282067-9.webp",
  },
  {
    id: "zl201821256547-8",
    type: "实用新型",
    title: "一种钢衬四氟反应釜",
    number: "ZL 2018 2 1256547.8",
    image: "/images/site/patents/zl201821256547-8.webp",
  },
] as const;
