import { prisma } from "@/lib/prisma";
import {
  fetchComplexesByRegion,
  fetchArticlesByComplex,
} from "@/lib/naver-api";
import { TRADE_TYPES } from "@/lib/types";
import type { ComplexItem, TradeTypeCode } from "@/lib/types";
import { crawlEmitter, type CrawlEvent } from "@/lib/crawl-events";

export type ProgressCallback = (event: CrawlEvent) => void;

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

export async function crawlRegion(
  regionId: number,
  cortarNo: string,
  meta?: { regionName: string; current: number; total: number },
  onProgress?: ProgressCallback
) {
  const emit = (event: CrawlEvent) => {
    crawlEmitter.emitCrawl(event);
    onProgress?.(event);
  };

  const crawlStartedAt = new Date();
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

    console.log(`[Crawl] 단지 목록 수집 중...`);
    while (hasNextPage) {
      const result = await fetchComplexesByRegion(cortarNo, pageNum);
      for (const complex of result.list) {
        allComplexes.push(complex);
      }
      console.log(`[Crawl] 페이지 ${pageNum + 1}: ${result.list.length}개 단지 (총 ${allComplexes.length}/${result.totalCount})`);
      hasNextPage = result.hasNextPage;
      pageNum++;
      if (hasNextPage) await delay(1500);
    }

    // Filter out complexes with 0 total articles
    const activeComplexes = allComplexes.filter(
      (c) => c.dealCount + c.leaseDepositCount + c.leaseMonthlyCount > 0
    );
    const skippedComplexes = allComplexes.length - activeComplexes.length;

    // Calculate how many API calls we save
    const naiveApiCalls = allComplexes.length * tradeTypes.length;
    let actualApiCalls = 0;
    let skippedTradeTypeCalls = 0;

    console.log(
      `[Crawl] Found ${allComplexes.length} complexes in region ${cortarNo}, ` +
        `${skippedComplexes} skipped (0 articles), ${activeComplexes.length} to crawl`
    );

    // Step 2: For each complex, fetch articles by trade type (skip if count is 0)
    for (let i = 0; i < activeComplexes.length; i++) {
      const complex = activeComplexes[i];
      console.log(
        `[Crawl] [${i + 1}/${activeComplexes.length}] ${complex.name} (매매:${complex.dealCount} 전세:${complex.leaseDepositCount} 월세:${complex.leaseMonthlyCount})`
      );
      emit({
        type: "crawl:complex",
        complexName: complex.name,
        current: i + 1,
        total: activeComplexes.length,
        regionName: meta?.regionName ?? cortarNo,
      });

      for (const tradeType of tradeTypes) {
        const count = getArticleCount(complex, tradeType);
        if (count === 0) {
          skippedTradeTypeCalls++;
          continue;
        }

        actualApiCalls++;
        console.log(
          `[Crawl]   → ${TRADE_TYPES[tradeType]} ${count}건 조회 중...`
        );
        const articles = await fetchArticlesByComplex(
          complex.complexNumber,
          tradeType
        );
        console.log(
          `[Crawl]   → ${articles.length}건 수집`
        );

        for (const article of articles) {
          // Skip invalid articles: no ID or no price
          if (!article.articleNumber || article.price <= 0) continue;
          totalFound++;
          const existing = await prisma.listing.findUnique({
            where: { naverArticleId: article.articleNumber },
          });

          if (existing) {
            await prisma.listing.update({
              where: { id: existing.id },
              data: {
                lastSeenAt: new Date(),
                isActive: true,
                // Update price if it was 0 or changed
                ...(article.price > 0 ? { price: article.price } : {}),
                ...(article.rentPrice != null ? { rentPrice: article.rentPrice } : {}),
                ...(article.area != null ? { area: article.area } : {}),
                ...(article.floor != null ? { floor: article.floor } : {}),
                ...(article.description != null ? { description: article.description } : {}),
                propertyType: article.propertyType || existing.propertyType,
              },
            });
            updatedListings++;
          } else {
            await prisma.listing.create({
              data: {
                naverArticleId: article.articleNumber,
                regionId,
                propertyType: article.propertyType || "A01",
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

    // Deactivate listings not seen in this crawl
    const deactivated = await prisma.listing.updateMany({
      where: {
        regionId,
        isActive: true,
        lastSeenAt: { lt: crawlStartedAt },
      },
      data: { isActive: false },
    });
    if (deactivated.count > 0) {
      console.log(`[Crawl] ${deactivated.count}건 매물 비활성 처리 (이번 크롤에서 미발견)`);
    }

    emit({
      type: "crawl:region_done",
      regionName: meta?.regionName ?? cortarNo,
      newListings,
      updatedListings,
      deactivated: deactivated.count,
    });

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

export async function crawlAllActiveRegions(onProgress?: ProgressCallback) {
  const emit = (event: CrawlEvent) => {
    crawlEmitter.emitCrawl(event);
    onProgress?.(event);
  };

  const regions = await prisma.region.findMany({
    where: { isActive: true, cortarType: "eup" },
  });
  console.log(`[Crawl] Starting crawl for ${regions.length} active regions`);
  emit({ type: "crawl:start", totalRegions: regions.length });

  const results = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    try {
      console.log(`[Crawl] Crawling ${region.name} (${region.cortarNo})`);
      emit({
        type: "crawl:region",
        regionName: region.name,
        current: i + 1,
        total: regions.length,
      });
      const result = await crawlRegion(region.id, region.cortarNo, {
        regionName: region.name,
        current: i + 1,
        total: regions.length,
      }, onProgress);
      console.log(
        `[Crawl] ${region.name}: ${result.newListings} new, ${result.updatedListings} updated`
      );
      results.push({ region: region.name, ...result });
    } catch (error) {
      console.error(`[Crawl] Error crawling ${region.name}:`, error);
      emit({
        type: "crawl:error",
        message: `${region.name}: ${error instanceof Error ? error.message : String(error)}`,
      });
      results.push({ region: region.name, error: String(error) });
    }
  }

  emit({ type: "crawl:complete", results });
  return results;
}
