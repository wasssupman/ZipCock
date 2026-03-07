import { prisma } from "@/lib/prisma";
import {
  fetchComplexesByRegion,
  fetchArticlesByComplex,
  closeBrowser,
} from "@/lib/naver-api";
import { TRADE_TYPES } from "@/lib/types";
import type { ComplexItem, TradeTypeCode } from "@/lib/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Map trade type codes to the ComplexItem count fields */
function getArticleCount(
  complex: ComplexItem,
  tradeType: TradeTypeCode
): number {
  switch (tradeType) {
    case "A1":
      return complex.dealCount;
    case "B1":
      return complex.leaseDepositCount;
    case "B2":
      return complex.leaseMonthlyCount;
    default:
      return 0;
  }
}

export async function crawlRegion(regionId: number, cortarNo: string) {
  const log = await prisma.crawlLog.create({
    data: { regionId, status: "running" },
  });

  let totalFound = 0;
  let newListings = 0;
  let updatedListings = 0;

  try {
    // Step 1: Get all complexes in this region (eup code)
    // Exclude B3 (단기) — rarely used, not worth the API call
    const tradeTypes = (
      Object.keys(TRADE_TYPES) as TradeTypeCode[]
    ).filter((t) => t !== "B3");
    let pageNum = 0;
    let hasNextPage = true;
    const allComplexes: ComplexItem[] = [];

    while (hasNextPage) {
      const result = await fetchComplexesByRegion(cortarNo, pageNum);
      for (const complex of result.list) {
        allComplexes.push(complex);
      }
      hasNextPage = result.hasNextPage;
      pageNum++;
      await delay(1500);
    }

    // Filter out complexes with 0 total articles
    const activeComplexes = allComplexes.filter(
      (c) => c.dealCount + c.leaseDepositCount + c.leaseMonthlyCount > 0
    );
    const skippedComplexes = allComplexes.length - activeComplexes.length;

    // Calculate how many API calls we save
    const naiveApiCalls = allComplexes.length * 4; // 4 trade types per complex
    let actualApiCalls = 0;
    let skippedTradeTypeCalls = 0;

    console.log(
      `[Crawl] Found ${allComplexes.length} complexes in region ${cortarNo}, ` +
        `${skippedComplexes} skipped (0 articles), ${activeComplexes.length} to crawl`
    );

    // Step 2: For each complex, fetch articles by trade type (skip if count is 0)
    for (const complex of activeComplexes) {
      for (const tradeType of tradeTypes) {
        if (getArticleCount(complex, tradeType) === 0) {
          skippedTradeTypeCalls++;
          continue;
        }

        actualApiCalls++;
        const articles = await fetchArticlesByComplex(
          complex.complexNumber,
          tradeType
        );

        for (const article of articles) {
          totalFound++;
          const existing = await prisma.listing.findUnique({
            where: { naverArticleId: article.articleNumber },
          });

          if (existing) {
            await prisma.listing.update({
              where: { id: existing.id },
              data: { lastSeenAt: new Date(), isActive: true },
            });
            updatedListings++;
          } else {
            await prisma.listing.create({
              data: {
                naverArticleId: article.articleNumber,
                regionId,
                propertyType: "A01",
                tradeType,
                price: article.price,
                rentPrice: article.rentPrice || null,
                area: article.area || null,
                floor: article.floor || null,
                buildingName: article.articleName || null,
                description: article.description || null,
                naverUrl: `https://fin.land.naver.com/complexes/${complex.complexNumber}?tab=article`,
              },
            });
            newListings++;
          }
        }

        await delay(1500);
      }
    }

    console.log(
      `[Crawl] API calls: ${actualApiCalls} made, ${skippedTradeTypeCalls + skippedComplexes * tradeTypes.length} skipped ` +
        `(would have been ${naiveApiCalls} without optimization)`
    );

    await prisma.crawlLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFound,
        newListings,
        updatedListings,
        status: "success",
      },
    });

    return { totalFound, newListings, updatedListings };
  } catch (error) {
    await prisma.crawlLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFound,
        newListings,
        updatedListings,
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export async function crawlAllActiveRegions() {
  const regions = await prisma.region.findMany({ where: { isActive: true } });
  console.log(`[Crawl] Starting crawl for ${regions.length} active regions`);

  const results = [];
  for (const region of regions) {
    try {
      console.log(`[Crawl] Crawling ${region.name} (${region.cortarNo})`);
      const result = await crawlRegion(region.id, region.cortarNo);
      console.log(
        `[Crawl] ${region.name}: ${result.newListings} new, ${result.updatedListings} updated`
      );
      results.push({ region: region.name, ...result });
    } catch (error) {
      console.error(`[Crawl] Error crawling ${region.name}:`, error);
      results.push({ region: region.name, error: String(error) });
    }
  }

  return results;
}
