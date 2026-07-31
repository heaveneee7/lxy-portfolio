import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders local portfolio 5.0 with the verified project map", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>李馨月｜求职作品集 5\.0（本地预览）<\/title>/);
  assert.match(html, /LXY::PORTFOLIO_5\.0/);
  assert.match(html, /桐香竹韵/);
  assert.match(html, /一路追“光”/);
  assert.match(html, /融合媒体新闻报道/);
  assert.match(html, /你好，李馨月/);
  assert.match(html, /存在之镜/);
  assert.match(html, /li-xinyue-undergraduate-thesis\.pdf/);
  assert.match(html, /点击图片，/);
  assert.match(html, /Blender/);
  assert.match(html, /resident-questionnaire-analysis\.pdf/);
  assert.match(html, /market-survey-results\.pdf/);
  assert.doesNotMatch(html, /market-questionnaire\.(docx|pdf)/);
  assert.doesNotMatch(html, /resident-awareness-questionnaire\.(docx|pdf)/);
  assert.match(html, /og-portfolio\.webp/);
});

test("keeps the physical interactions and required local assets", async () => {
  const [client, css, layout] = await Promise.all([
    readFile(new URL("../app/PortfolioClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(client, /HOLD_STILL::MAGNET/);
  assert.match(client, /cat-crouch\.png/);
  assert.match(client, /cat-jump\.png/);
  assert.match(client, /vlog-129-web\.mp4/);
  assert.match(client, /weixin\.qq\.com\/sph\/AsXg88pFJH/);
  assert.match(client, /bilibili\.com\/video\/BV1ya411P7j4/);
  assert.match(client, /challenge-application-bcf\.doc/);
  assert.match(client, /intro-p4-goals\.webp/);
  assert.match(client, /function UmbrellaCanvas/);
  assert.match(client, /function ThesisProject/);
  assert.match(client, /thesis-moon-tableau/);
  assert.match(client, /thesis-archive-board/);
  assert.match(client, /vintage-rose-collage\.png/);
  assert.match(client, /vintage-daisy-collage\.png/);
  assert.match(client, /pink-paperclip/);
  assert.doesNotMatch(css, /STKaiti|KaiTi|FangSong/);
  assert.match(css, /ZCOOL QingKe HuangYou/);
  assert.match(css, /@keyframes pageForward/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(layout, /ASCII 数字档案与手工纸张/);

  await Promise.all([
    access(new URL("../public/assets/illustrations/umbrella-ink.png", import.meta.url)),
    access(new URL("../public/assets/illustrations/cat-crouch.png", import.meta.url)),
    access(new URL("../public/assets/december/vlog-129-web.mp4", import.meta.url)),
    access(new URL("../public/assets/profile/lixinyue-headshot.jpg", import.meta.url)),
    access(new URL("../public/assets/thesis/li-xinyue-undergraduate-thesis.pdf", import.meta.url)),
    access(new URL("../public/assets/thesis/li-xinyue-undergraduate-thesis.docx", import.meta.url)),
    access(new URL("../public/assets/thesis/significant-paths.png", import.meta.url)),
    access(new URL("../public/assets/thesis/satin-bow-frame.png", import.meta.url)),
    access(new URL("../public/assets/thesis/pearl-bow-frame.png", import.meta.url)),
    access(new URL("../public/assets/thesis/moon-girl.png", import.meta.url)),
    access(new URL("../public/assets/thesis/vintage-rose-collage.png", import.meta.url)),
    access(new URL("../public/assets/thesis/vintage-daisy-collage.png", import.meta.url)),
    access(new URL("../public/og-portfolio.webp", import.meta.url)),
  ]);
});
