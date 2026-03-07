const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  const page = await context.newPage();

  page.on('response', async (resp) => {
    const url = resp.url();
    const dominated = ['.js', '.css', '.png', '.svg', '.woff', 'polaris', 'nstat', 'shopv', 'favicon', '.ico', 'gfp'];
    if (url.includes('naver.com') && !dominated.some(d => url.includes(d))) {
      let body = '';
      try { body = (await resp.text()).substring(0, 300); } catch {}
      console.log(resp.status(), url);
      if (body && !url.endsWith('.html') && body.length < 300) console.log('  BODY:', body);
    }
  });

  await page.goto('https://fin.land.naver.com/regions?si=1100000000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  await browser.close();
})();
