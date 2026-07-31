export const PORTFOLIO_VERSION = "6.0";

export const navigation = [
  ["#home", "00_HOME"],
  ["#index", "01_INDEX"],
  ["#umbrella", "02_WORKS"],
  ["#book", "03_BOOK"],
  ["#thesis", "04_THESIS"],
  ["#about", "05_PROFILE"],
] as const;

export const chainItems = [
  { href: "#umbrella", label: "桐香竹韵", sub: "FIELD RESEARCH", kind: "umbrella", length: 0.47 },
  { href: "#december", label: "12·9", sub: "VIDEO / SCRIPT", kind: "plate", length: 0.35 },
  { href: "#petroleum", label: "塔里木现场", sub: "REPORTING", kind: "helmet", length: 0.56 },
  { href: "#book", label: "你好，李馨月", sub: "ILLUSTRATOR", kind: "book", length: 0.41 },
  { href: "#thesis", label: "毕业论文", sub: "RESEARCH / SEM", kind: "moon", length: 0.52 },
  { href: "#blender", label: "3D学习档案", sub: "BLENDER", kind: "building", length: 0.61 },
  { href: "#about", label: "求职档案", sub: "PROFILE", kind: "figure", length: 0.38 },
] as const;

export const blenderWorks = [
  { title: "兰大·至公楼", note: "建筑还原 / 实时渲染", src: "/assets/blender/zhigong-building.png" },
  { title: "罗小黑·猫形", note: "角色建模 / 材质练习", src: "/assets/blender/luoxiaohei-cat.png" },
  { title: "罗小黑·人形", note: "角色灰模 / 姿势练习", src: "/assets/blender/luoxiaohei-human.png" },
  { title: "皮卡丘", note: "角色建模 / 骨骼动画", src: "/assets/blender/pikachu.png" },
  { title: "学习档案", note: "烟灰缸迭代 / 瓦房练习", src: "/assets/blender/ashtray-second.png" },
] as const;

export const surveyDocuments = [
  {
    title: "分水油纸伞调研问卷一分析二",
    pdf: "/assets/umbrella/documents/resident-questionnaire-analysis.pdf",
    docx: "/assets/umbrella/documents/resident-questionnaire-analysis.docx",
  },
  {
    title: "市场调研问卷结果",
    pdf: "/assets/umbrella/documents/market-survey-results.pdf",
    docx: "/assets/umbrella/documents/market-survey-results.docx",
  },
] as const;
