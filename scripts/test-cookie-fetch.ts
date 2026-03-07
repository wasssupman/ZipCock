import { chromium } from "playwright";

const API_URL =
  "https://fin.land.naver.com/front-api/v1/complex/region?eupLegalDivisionNumber=1168010100&size=5&sortType=HOUSEHOLD&page=0";
const SITE_URL = "https://fin.land.naver.com/regions";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function main() {
  console.log("=== Step 1: Launch Playwright Browser ===");
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  console.log("=== Step 2: Navigate to establish session ===");
  const page = await context.newPage();
  await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait for page to fully load and cookies to be set
  await page.waitForTimeout(5000);

  console.log("=== Step 3: Extract Cookies ===");
  const cookies = await context.cookies();
  console.log(`Cookies found (${cookies.length}):`);
  for (const c of cookies) {
    console.log(`  - ${c.name} (domain: ${c.domain}, path: ${c.path})`);
  }

  // Build cookie header string
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  console.log("\n=== Step 4: Close Browser ===");
  await page.close();
  await browser.close();

  console.log("\n=== Step 5: Direct Fetch with Cookies + Headers ===");
  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    "User-Agent": USER_AGENT,
    Referer: "https://fin.land.naver.com/regions",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  console.log("Request headers (keys):", Object.keys(headers).join(", "));

  try {
    const response = await fetch(API_URL, { headers });
    const status = response.status;
    const bodyText = await response.text();
    const bodyPreview = bodyText.substring(0, 500);

    console.log(`\nStatus: ${status}`);
    console.log(`Body preview: ${bodyPreview}`);

    if (status === 200) {
      try {
        const json = JSON.parse(bodyText);
        console.log(`\nisSuccess: ${json.isSuccess}`);
        if (json.result?.list) {
          console.log(`Result count: ${json.result.list.length}`);
          console.log(`hasNextPage: ${json.result.hasNextPage}`);
          console.log(`totalCount: ${json.result.totalCount}`);
        }
      } catch {
        // not JSON
      }
    }

    console.log("\n=== Conclusion ===");
    if (status === 200) {
      console.log("Cookie-based fetch: WORKS");
      console.log(
        "We can use Playwright once to get cookies, then use fetch() for subsequent calls."
      );
    } else {
      console.log(`Cookie-based fetch: DOES NOT WORK (status ${status})`);
      console.log(
        "Cookies alone (even with headers) are not sufficient. Playwright is needed per-request."
      );
    }
  } catch (err) {
    console.error("Fetch error:", err);
    console.log("\n=== Conclusion ===");
    console.log("Cookie-based fetch: DOES NOT WORK (fetch error)");
  }
}

main().catch(console.error);
