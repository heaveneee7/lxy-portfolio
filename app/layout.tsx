import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "李馨月｜求职作品集 6.0（本地预览）",
  description: "李馨月的求职作品集：内容策划、新闻采写、新媒体运营、影像制作、社会调研与视觉表达。",
  openGraph: {
    title: "李馨月｜求职作品集 6.0（本地预览）",
    description: "ASCII 数字档案与手工纸张交织的个人作品集。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og-portfolio.webp", width: 1536, height: 1024, alt: "李馨月 Portfolio 6.0 local preview" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
