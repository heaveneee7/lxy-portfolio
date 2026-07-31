const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  for (const [name, hash] of [
    ["home", "#home"],
    ["thesis", "#thesis"],
    ["umbrella", "#umbrella"],
    ["about", "#about"],
  ]) {
    await page.goto(`http://localhost:3004/?v=6${hash}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `qa/portfolio6-${name}.png`, fullPage: false });
  }
  await page.goto("http://localhost:3004/?v=6#thesis", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  for (const [name, selector] of [
    ["thesis-title", ".thesis-title-composition"],
    ["thesis-data", ".thesis-research-board"],
    ["thesis-archive", ".thesis-archive-board"],
    ["cat-stage", ".cat-stage"],
  ]) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const box = await locator.boundingBox();
      console.log(name, box);
      await page.screenshot({ path: `qa/portfolio6-${name}.png`, fullPage: false });
    }
  }
  await browser.close();
})();
