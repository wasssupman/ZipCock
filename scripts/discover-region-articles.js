/**
 * m.land.naver.com API 탐색 - 주택 매물 조회
 * fin.land 주택 버튼이 m.land.naver.com 주택 map 페이지로 연결
 */
const { chromium } = require('playwright');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ userAgent: UA });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  const page = await ctx.newPage();

  // Capture API calls
  page.on('response', async (resp) => {
    const url = resp.url();
    if ((url.includes('/api/') || url.includes('land.naver.com')) && resp.status() === 200 && url.includes('article')) {
      try {
        const text = await resp.text();
        const data = JSON.parse(text);
        console.log(`\n✅ ARTICLE API: ${resp.request().method()} ${url}`);
        console.log(`   Status: ${resp.status()}`);
        // Check various response shapes
        const list = data.articleList || data.result?.list || data.body;
        if (Array.isArray(list) && list.length > 0) {
          console.log(`   Items: ${list.length}`);
          console.log('   KEYS:', Object.keys(list[0]).join(', '));
          console.log('   FIRST:', JSON.stringify(list[0], null, 2).slice(0, 2000));
        } else {
          console.log('   Response keys:', Object.keys(data).join(', '));
          console.log('   Raw:', JSON.stringify(data).slice(0, 500));
        }
        if (resp.request().postData()) console.log('   POST:', resp.request().postData());
      } catch {}
    }
  });

  // Navigate to the 주택 map page - 용인 수지 죽전1동
  console.log('Loading m.land.naver.com 주택 map...');
  await page.goto('https://m.land.naver.com/map/41465/JWJT:DDDGG:SGJT:HOJT/A1:B1:B2', {
    waitUntil: 'networkidle', timeout: 60000
  });
  await page.waitForTimeout(8000);

  // Check all network requests made
  console.log('\n--- Checking page for article list elements ---');
  const pageContent = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      bodyText: document.body.innerText.slice(0, 1000),
    };
  });
  console.log('URL:', pageContent.url);
  console.log('Title:', pageContent.title);
  console.log('Content:', pageContent.bodyText.slice(0, 500));

  // Try direct API calls to m.land.naver.com
  console.log('\n\n--- Direct API tests ---');
  const cookies = await ctx.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const endpoints = [
    {
      label: '1. cluster list (get lgeo keys)',
      url: 'https://m.land.naver.com/cluster/clusterList?view=atcl&cortarNo=4146510100&rletTpCd=JWJT:DDDGG:SGJT:HOJT&tradTpCd=A1:B1:B2&z=14&lat=37.32&lon=127.10&btm=37.30&lft=127.05&top=37.35&rgt=127.15',
    },
    {
      label: '2. article list by lgeo (lgeo from cluster)',
      url: 'https://m.land.naver.com/cluster/ajax/articleList?itemId=2120313003&lgeo=2120313003&rletTpCd=JWJT:DDDGG:SGJT:HOJT&tradTpCd=A1:B1:B2&z=14&lat=37.325&lon=127.100&page=1',
    },
    {
      label: '3. article list - JWJT only',
      url: 'https://m.land.naver.com/cluster/ajax/articleList?itemId=2120313003&lgeo=2120313003&rletTpCd=JWJT&tradTpCd=A1&z=14&lat=37.325&lon=127.100&page=1',
    },
    {
      label: '4. article list by cortarNo',
      url: 'https://m.land.naver.com/cluster/ajax/articleList?cortarNo=4146510100&rletTpCd=JWJT:DDDGG:SGJT:HOJT&tradTpCd=A1:B1:B2&page=1',
    },
  ];

  for (const ep of endpoints) {
    console.log(`\n=== ${ep.label} ===`);
    try {
      const res = await fetch(ep.url, {
        headers: {
          Cookie: cookieHeader,
          'User-Agent': UA,
          Referer: 'https://m.land.naver.com/',
          Accept: 'application/json, text/plain, */*',
        },
      });
      console.log('Status:', res.status);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        console.log('Keys:', Object.keys(data).join(', '));
        console.log('Data:', JSON.stringify(data, null, 2).slice(0, 1500));
      } catch {
        console.log('Raw:', text.slice(0, 500));
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();
  console.log('\nDone.');
})().catch(e => console.error('FATAL:', e));
