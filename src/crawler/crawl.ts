import { prisma } from "@/lib/prisma";
import {
  fetchComplexesByRegion,
  fetchArticlesByComplex,
  fetchNonComplexArticles,
} from "@/lib/naver-api";
import { TRADE_TYPES } from "@/lib/types";
import type { ArticleItem, ComplexItem, TradeTypeCode } from "@/lib/types";
import { crawlEmitter, type CrawlEvent } from "@/lib/crawl-events";
import { analyzeNewListings } from "./analyze";

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

  // Prevent concurrent crawls for the same region
  const runningCrawl = await prisma.crawlLog.findFirst({
    where: { regionId, status: "running" },
  });
  if (runningCrawl) {
    console.log(`[Crawl] Region ${regionId} already being crawled, skipping`);
    return { totalFound: 0, newListings: 0, updatedListings: 0, deactivated: 0 };
  }

  const crawlStartedAt = new Date();
  const log = await prisma.crawlLog.create({
    data: { regionId, status: "running" },
  });

  let totalFound = 0;
  let newListings = 0;
  let updatedListings = 0;
  const newListingIds: number[] = [];

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

        let articles;
        try {
          articles = await fetchArticlesByComplex(
            complex.complexNumber,
            tradeType
          );
        } catch (error) {
          console.error(
            `[Crawl]   → API 오류 (${complex.name} ${TRADE_TYPES[tradeType]}):`,
            error instanceof Error ? error.message : String(error)
          );
          continue;
        }

        console.log(
          `[Crawl]   → ${articles.length}건 수집`
        );

        // Batch lookup: find existing articles
        const validArticles = articles.filter(
          (a) => a.articleNumber && a.price > 0
        );
        if (validArticles.length === 0) continue;

        totalFound += validArticles.length;
        const articleNumbers = validArticles.map((a) => a.articleNumber);
        const existingListings = await prisma.listing.findMany({
          where: { naverArticleId: { in: articleNumbers } },
        });
        const existingMap = new Map(
          existingListings.map((l) => [l.naverArticleId, l] as const)
        );

        // Separate into updates and creates
        const toUpdate: typeof validArticles = [];
        const toCreate: typeof validArticles = [];
        for (const article of validArticles) {
          if (existingMap.has(article.articleNumber)) {
            toUpdate.push(article);
          } else {
            toCreate.push(article);
          }
        }

        // Batch update existing listings + detect price changes
        if (toUpdate.length > 0) {
          const priceChanges: { listingId: number; oldPrice: number; newPrice: number }[] = [];
          for (const article of toUpdate) {
            const existing = existingMap.get(article.articleNumber)!;
            if (article.price > 0 && existing.price !== article.price) {
              priceChanges.push({
                listingId: existing.id,
                oldPrice: existing.price,
                newPrice: article.price,
              });
            }
          }

          await prisma.$transaction([
            ...toUpdate.map((article) => {
              const existing = existingMap.get(article.articleNumber)!;
              return prisma.listing.update({
                where: { id: existing.id },
                data: {
                  lastSeenAt: new Date(),
                  isActive: true,
                  ...(article.price > 0 ? { price: article.price } : {}),
                  ...(article.rentPrice != null
                    ? { rentPrice: article.rentPrice }
                    : {}),
                  ...(article.area != null ? { area: article.area } : {}),
                  ...(article.floor != null ? { floor: article.floor } : {}),
                  ...(article.description != null
                    ? { description: article.description }
                    : {}),
                  propertyType:
                    article.propertyType || existing.propertyType,
                },
              });
            }),
            ...priceChanges.map((pc) =>
              prisma.priceHistory.create({ data: pc })
            ),
          ]);

          if (priceChanges.length > 0) {
            console.log(`[Crawl]   → ${priceChanges.length}건 가격 변동 감지`);
          }
          updatedListings += toUpdate.length;
        }

        // Batch create new listings
        if (toCreate.length > 0) {
          for (const article of toCreate) {
            const created = await prisma.listing.create({
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
                articleConfirmDate: article.articleConfirmDate || null,
                naverUrl: `https://fin.land.naver.com/complexes/${complex.complexNumber}?tab=article`,
              },
            });
            newListingIds.push(created.id);
          }
          newListings += toCreate.length;
        }

        await delay(1500);
      }
    }

    console.log(
      `[Crawl] API calls: ${actualApiCalls} made, ${skippedTradeTypeCalls + skippedComplexes * tradeTypes.length} skipped ` +
        `(would have been ${naiveApiCalls} without optimization)`
    );

    // Phase 2: Non-complex properties (주택/단독다가구/상가주택) via m.land API
    try {
      const nonComplexArticles = await fetchNonComplexArticles(
        cortarNo,
        tradeTypes
      );

      if (nonComplexArticles.length > 0) {
        emit({
          type: "crawl:non_complex",
          regionName: meta?.regionName ?? cortarNo,
          count: nonComplexArticles.length,
        });
        console.log(`[Crawl] 비단지 매물 ${nonComplexArticles.length}건 처리 중...`);

        // Group by tradeType for processing
        const byTrade = new Map<string, ArticleItem[]>();
        for (const article of nonComplexArticles) {
          const tt = article.tradeType || "A1";
          if (!byTrade.has(tt)) byTrade.set(tt, []);
          byTrade.get(tt)!.push(article);
        }

        for (const [tt, articles] of byTrade) {
          const validArticles = articles.filter(
            (a) => a.articleNumber && a.price > 0
          );
          if (validArticles.length === 0) continue;

          totalFound += validArticles.length;
          const articleNumbers = validArticles.map((a) => a.articleNumber);
          const existingListings = await prisma.listing.findMany({
            where: { naverArticleId: { in: articleNumbers } },
          });
          const existingMap = new Map(
            existingListings.map((l) => [l.naverArticleId, l] as const)
          );

          const toUpdate: typeof validArticles = [];
          const toCreate: typeof validArticles = [];
          for (const article of validArticles) {
            if (existingMap.has(article.articleNumber)) {
              toUpdate.push(article);
            } else {
              toCreate.push(article);
            }
          }

          if (toUpdate.length > 0) {
            const priceChanges: { listingId: number; oldPrice: number; newPrice: number }[] = [];
            for (const article of toUpdate) {
              const existing = existingMap.get(article.articleNumber)!;
              if (article.price > 0 && existing.price !== article.price) {
                priceChanges.push({
                  listingId: existing.id,
                  oldPrice: existing.price,
                  newPrice: article.price,
                });
              }
            }

            await prisma.$transaction([
              ...toUpdate.map((article) => {
                const existing = existingMap.get(article.articleNumber)!;
                return prisma.listing.update({
                  where: { id: existing.id },
                  data: {
                    lastSeenAt: new Date(),
                    isActive: true,
                    ...(article.price > 0 ? { price: article.price } : {}),
                    ...(article.rentPrice != null ? { rentPrice: article.rentPrice } : {}),
                    ...(article.area != null ? { area: article.area } : {}),
                    ...(article.floor != null ? { floor: article.floor } : {}),
                    ...(article.description != null ? { description: article.description } : {}),
                    propertyType: article.propertyType || existing.propertyType,
                  },
                });
              }),
              ...priceChanges.map((pc) =>
                prisma.priceHistory.create({ data: pc })
              ),
            ]);

            if (priceChanges.length > 0) {
              console.log(`[Crawl]   → 비단지 ${priceChanges.length}건 가격 변동 감지`);
            }
            updatedListings += toUpdate.length;
          }

          if (toCreate.length > 0) {
            for (const article of toCreate) {
              const created = await prisma.listing.upsert({
                where: { naverArticleId: article.articleNumber },
                update: {
                  lastSeenAt: new Date(),
                  isActive: true,
                  ...(article.price > 0 ? { price: article.price } : {}),
                  ...(article.rentPrice != null ? { rentPrice: article.rentPrice } : {}),
                  ...(article.area != null ? { area: article.area } : {}),
                  ...(article.floor != null ? { floor: article.floor } : {}),
                  ...(article.description != null ? { description: article.description } : {}),
                  propertyType: article.propertyType || "DDDGG",
                },
                create: {
                  naverArticleId: article.articleNumber,
                  regionId,
                  propertyType: article.propertyType || "DDDGG",
                  tradeType: tt,
                  price: article.price,
                  rentPrice: article.rentPrice || null,
                  area: article.area || null,
                  floor: article.floor || null,
                  buildingName: article.articleName || null,
                  description: article.description || null,
                  articleConfirmDate: article.articleConfirmDate || null,
                  naverUrl: `https://m.land.naver.com/article/info/${article.articleNumber}`,
                },
              });
              newListingIds.push(created.id);
            }
            newListings += toCreate.length;
          }
        }

        console.log(`[Crawl] 비단지 매물 처리 완료: ${nonComplexArticles.length}건`);
      }
    } catch (error) {
      console.error(
        `[Crawl] 비단지 매물 크롤링 오류:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    // Deactivate listings not seen in this crawl
    // Safety: skip deactivation if we found 0 listings but there are active ones
    // (likely API failure, not actual removal of all listings)
    let deactivatedCount = 0;
    const activeCount = await prisma.listing.count({
      where: { regionId, isActive: true },
    });
    if (totalFound === 0 && activeCount > 0) {
      console.warn(
        `[Crawl] 이번 크롤에서 0건 발견, 기존 ${activeCount}건 비활성화 생략 (API 오류 가능성)`
      );
    } else {
      const deactivated = await prisma.listing.updateMany({
        where: {
          regionId,
          isActive: true,
          lastSeenAt: { lt: crawlStartedAt },
        },
        data: { isActive: false },
      });
      deactivatedCount = deactivated.count;
      if (deactivatedCount > 0) {
        console.log(`[Crawl] ${deactivatedCount}건 매물 비활성 처리 (이번 크롤에서 미발견)`);
      }
    }

    // AI 분석: 신규 매물에 대해 Claude CLI로 가격/인프라 레벨 판단
    if (newListingIds.length > 0) {
      emit({
        type: "crawl:analyze",
        regionName: meta?.regionName ?? cortarNo,
        count: newListingIds.length,
      });
      try {
        const analyzed = await analyzeNewListings(newListingIds);
        emit({
          type: "crawl:analyze_done",
          regionName: meta?.regionName ?? cortarNo,
          analyzed,
        });
      } catch (error) {
        console.error(`[Crawl] AI 분석 오류:`, error instanceof Error ? error.message : String(error));
      }
    }

    emit({
      type: "crawl:region_done",
      regionName: meta?.regionName ?? cortarNo,
      newListings,
      updatedListings,
      deactivated: deactivatedCount,
    });

    await prisma.crawlLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFound,
        newListings,
        updatedListings,
        deactivatedListings: deactivatedCount,
        status: "success",
      },
    });

    return { totalFound, newListings, updatedListings, deactivated: deactivatedCount };
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
