import { chromium } from "playwright";
import type { RegionItem, ComplexItem, ArticleItem } from "./types";

// --- Cookie-based fetch infrastructure ---

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SITE_URL = "https://fin.land.naver.com/regions";
const COOKIE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let cachedCookies: string | null = null;
let cookieExpiry: number = 0;

async function refreshCookies(): Promise<void> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  await page.goto(SITE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);

  const cookies = await context.cookies();
  cachedCookies = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  cookieExpiry = Date.now() + COOKIE_TTL_MS;

  await page.close();
  await browser.close();
}

async function ensureCookies(): Promise<string> {
  if (!cachedCookies || Date.now() >= cookieExpiry) {
    await refreshCookies();
  }
  return cachedCookies!;
}

async function naverFetch(url: string): Promise<unknown> {
  const cookieHeader = await ensureCookies();
  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    "User-Agent": USER_AGENT,
    Referer: SITE_URL,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  let response = await fetch(url, { headers });

  if (response.status !== 200) {
    // Refresh cookies once and retry
    await refreshCookies();
    const retryHeaders = {
      ...headers,
      Cookie: cachedCookies!,
    };
    response = await fetch(url, { headers: retryHeaders });
  }

  return response.json();
}

// --- Public API ---

export async function closeBrowser(): Promise<void> {
  // No-op: browser is closed immediately after cookie extraction.
  // Kept for backward compatibility with crawl.ts.
}

export async function fetchRegions(
  si?: string,
  gun?: string
): Promise<RegionItem[]> {
  // fetchRegions still uses Playwright to scrape HTML links.
  // It is called infrequently from the web UI.
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();
  try {
    let url = "https://fin.land.naver.com/regions";
    if (si && gun) {
      url += `?si=${si}&gun=${gun}`;
    } else if (si) {
      url += `?si=${si}`;
    }
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a"))
        .filter((a) => {
          const href = a.href;
          return (
            href.includes("si=") ||
            href.includes("gun=") ||
            href.includes("eup=")
          );
        })
        .map((a) => ({ text: a.textContent?.trim() || "", href: a.href }));
    });

    return links
      .map((link) => {
        const parsed = new URL(link.href);
        const eup = parsed.searchParams.get("eup");
        const gunParam = parsed.searchParams.get("gun");
        const siParam = parsed.searchParams.get("si");

        let code: string;
        let type: "si" | "gun" | "eup";

        if (eup) {
          code = eup;
          type = "eup";
        } else if (gunParam && !gun) {
          code = gunParam;
          type = "gun";
        } else if (siParam && !si) {
          code = siParam;
          type = "si";
        } else {
          return null;
        }

        return { name: link.text, code, type };
      })
      .filter(
        (r): r is RegionItem => r !== null && r.name !== "직접입력"
      );
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function fetchComplexesByRegion(
  eupCode: string,
  pageNum: number = 0
): Promise<{
  list: ComplexItem[];
  hasNextPage: boolean;
  totalCount: number;
}> {
  const url = `https://fin.land.naver.com/front-api/v1/complex/region?eupLegalDivisionNumber=${eupCode}&size=20&sortType=HOUSEHOLD&page=${pageNum}`;
  const data = (await naverFetch(url)) as {
    isSuccess: boolean;
    result: {
      list: Array<Record<string, unknown>>;
      hasNextPage: boolean;
      totalCount: number;
    };
  };

  if (data.isSuccess) {
    return {
      list: data.result.list.map((item) => {
        const complexInfo = item.complexInfo as Record<string, unknown>;
        const articleCountInfo = item.articleCountInfo as Record<
          string,
          unknown
        >;
        return {
          complexNumber: complexInfo.complexNumber as number,
          name: complexInfo.name as string,
          type: complexInfo.type as string,
          totalHouseholdNumber:
            complexInfo.totalHouseholdNumber as number,
          dealCount: articleCountInfo.dealCount as number,
          leaseDepositCount:
            articleCountInfo.leaseDepositCount as number,
          leaseMonthlyCount:
            articleCountInfo.leaseMonthlyCount as number,
        };
      }),
      hasNextPage: data.result.hasNextPage,
      totalCount: data.result.totalCount,
    };
  }
  return { list: [], hasNextPage: false, totalCount: 0 };
}

export async function fetchArticlesByComplex(
  complexNumber: number,
  tradeType: string = "A1"
): Promise<ArticleItem[]> {
  const url = `https://fin.land.naver.com/front-api/v1/complex/article/list?complexNumber=${complexNumber}&tradeType=${tradeType}&page=0&size=20&orderType=DATE_DESC`;
  const data = (await naverFetch(url)) as {
    isSuccess: boolean;
    result?: {
      list?: Array<Record<string, unknown>>;
    };
  };

  if (data.isSuccess && data.result?.list) {
    return data.result.list.map(
      (item) => ({
        articleNumber: String(
          item.articleNumber || item.atclNo || ""
        ),
        articleName: String(
          item.articleName || item.complexName || ""
        ),
        tradeType,
        price: (item.dealPrice as number) ||
          (item.warrantyPrice as number) ||
          0,
        rentPrice: (item.monthlyPrice as number) || null,
        area: (item.exclusiveArea as number) || null,
        floor: (item.floor as string) || null,
        direction: (item.direction as string) || null,
        description: (item.description as string) || null,
      })
    );
  }
  return [];
}
