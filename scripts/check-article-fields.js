const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  const page = await ctx.newPage();
  await page.goto('https://fin.land.naver.com/regions', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  const cookies = await ctx.cookies();
  const cookieHeader = cookies.map(c => c.name + '=' + c.value).join('; ');
  await browser.close();

  const res = await fetch('https://fin.land.naver.com/front-api/v1/complex/article/list', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Referer: 'https://fin.land.naver.com/regions',
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      size: 2,
      complexNumber: '127728',
      tradeTypes: ['A1'],
      pyeongTypes: [],
      dongNumbers: [],
      userChannelType: 'PC',
      articleSortType: 'RANKING_DESC',
      seed: '',
      lastInfo: []
    })
  });
  const data = await res.json();
  console.log('SUCCESS:', data.isSuccess);
  if (data.result && data.result.list) {
    console.log('ITEM COUNT:', data.result.list.length);
    console.log('FIRST ITEM:', JSON.stringify(data.result.list[0], null, 2));
  }
})().catch(e => console.error('ERROR:', e));
