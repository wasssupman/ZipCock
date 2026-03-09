const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  const page = await ctx.newPage();
  let captured = false;
  page.on('response', async (resp) => {
    if (resp.url().includes('article/list') && !captured) {
      captured = true;
      const data = await resp.json();
      if (data.result && data.result.list && data.result.list[0]) {
        const item = data.result.list[0];
        console.log('TOP_KEYS:', Object.keys(item).join(', '));
        for (const key of Object.keys(item)) {
          const val = item[key];
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            console.log('  ' + key + ':', JSON.stringify(val));
          } else {
            console.log('  ' + key + ':', JSON.stringify(val));
          }
        }
      }
    }
  });
  await page.goto('https://fin.land.naver.com/complexes/127728?tab=article', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  await browser.close();
})().catch(e => console.error(e));
