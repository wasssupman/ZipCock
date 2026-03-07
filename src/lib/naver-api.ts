import { chromium, type Browser, type BrowserContext } from "playwright";
import type { RegionItem, ComplexItem, ArticleItem } from "./types";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function getBrowserContext(): Promise<BrowserContext> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });
  }
  return context!;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
}

export async function fetchRegions(
  si?: string,
  gun?: string
): Promise<RegionItem[]> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
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
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  try {
    const apiPromise = page
      .waitForResponse(
        (resp) => resp.url().includes("front-api/v1/complex/region"),
        { timeout: 15000 }
      )
      .catch(() => null);

    await page.goto(
      `https://fin.land.naver.com/regions?si=${eupCode.substring(0, 2)}00000000&gun=${eupCode.substring(0, 5)}00000&eup=${eupCode}`,
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );

    const apiResponse = await apiPromise;
    if (apiResponse) {
      const data = await apiResponse.json();
      if (data.isSuccess) {
        return {
          list: data.result.list.map((item: Record<string, unknown>) => {
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
    }
    return { list: [], hasNextPage: false, totalCount: 0 };
  } finally {
    await page.close();
  }
}

export async function fetchArticlesByComplex(
  complexNumber: number,
  tradeType: string = "A1"
): Promise<ArticleItem[]> {
  const ctx = await getBrowserContext();
  const page = await ctx.newPage();
  try {
    const apiPromise = page
      .waitForResponse(
        (resp) => resp.url().includes("front-api/v1/complex/article/list"),
        { timeout: 15000 }
      )
      .catch(() => null);

    await page.goto(
      `https://fin.land.naver.com/complexes/${complexNumber}?tab=article&articleTradeTypes=${tradeType}`,
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
    await page.waitForTimeout(5000);

    const apiResponse = await apiPromise;
    if (apiResponse) {
      const data = await apiResponse.json();
      if (data.isSuccess && data.result?.list) {
        return data.result.list.map(
          (item: Record<string, unknown>) => ({
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
    }
    return [];
  } finally {
    await page.close();
  }
}
