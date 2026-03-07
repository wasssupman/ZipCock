import { prisma } from "@/lib/prisma";
import { fetchArticles } from "@/lib/naver-api";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import type { PropertyTypeCode, TradeTypeCode } from "@/lib/types";

export async function crawlRegion(regionId: number, cortarNo: string) {
  const log = await prisma.crawlLog.create({
    data: { regionId, status: "running" },
  });

  let totalFound = 0;
  let newListings = 0;
  let updatedListings = 0;

  try {
    const propertyTypes = Object.keys(PROPERTY_TYPES) as PropertyTypeCode[];
    const tradeTypes = Object.keys(TRADE_TYPES) as TradeTypeCode[];

    for (const propertyType of propertyTypes) {
      for (const tradeType of tradeTypes) {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const data = await fetchArticles(
            cortarNo,
            tradeType,
            propertyType,
            page
          );
          if (!data.articleList || data.articleList.length === 0) break;

          for (const article of data.articleList) {
            totalFound++;
            const existing = await prisma.listing.findUnique({
              where: { naverArticleId: article.atclNo },
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
                  naverArticleId: article.atclNo,
                  regionId,
                  propertyType,
                  tradeType,
                  price: article.prc,
                  rentPrice: article.rentPrc || null,
                  area: article.spc2 || null,
                  floor: article.flrInfo || null,
                  buildingName: article.atclNm || null,
                  description: article.atclFetrDesc || null,
                  naverUrl: `https://new.land.naver.com/articles/${article.atclNo}`,
                },
              });
              newListings++;
            }
          }

          hasMore = data.isMoreData;
          page++;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

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
