# LXY's Portfolio｜李馨月求职作品集 6.0

这是李馨月用于求职展示的个人作品集网站，包含内容策划、新闻采写、融合媒体影像、社会调研、视觉表达与 Blender 学习档案。

## 内容结构

- `app/portfolio-data.ts`：导航、作品索引、问卷文件和 Blender 项目数据。
- `app/PortfolioClient.tsx`：页面结构与交互逻辑。
- `app/globals.css`：完整视觉系统、响应式布局与动效。
- `public/assets/`：图片、视频、PDF、DOC/DOCX 和字体等作品原件。

## 本地预览

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run build:github
```

推送至 `main` 分支后，GitHub Actions 会自动构建并发布 GitHub Pages。

线上访问：<https://heaveneee7.github.io/lxy-portfolio/>
