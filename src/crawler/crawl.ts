import { prisma } from "@/lib/prisma";
import {
  fetchComplexesByRegion,
  fetchArticlesByComplex,
  closeBrowser,
} from "@/lib/naver-api";
import { TRADE_TYPES } from "@/lib/types";
import type { TradeTypeCode } from "@/lib/types";

export async function crawlRegion(regionId: number, cortarNo: string) {
  const log = await prisma.crawlLog.create({
    data: { regionId, status: "running" },
  });

  let totalFound = 0;
  let newListings = 0;
  let updatedListings = 0;

  try {
    // Step 1: Get all complexes in this region (eup code)
    const tradeTypes = Object.keys(TRADE_TYPES) as TradeTypeCode[];
    let pageNum = 0;
    let hasNextPage = true;
    const allComplexNumbers: number[] = [];

    while (hasNextPage) {
      const result = await fetchComplexesByRegion(cortarNo, pageNum);
      for (const complex of result.list) {
        allComplexNumbers.push(complex.complexNumber);
      }
      hasNextPage = result.hasNextPage;
      pageNum++;
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log(
      `[Crawl] Found ${allComplexNumbers.length} complexes in region ${cortarNo}`
    );

    // Step 2: For each complex, fetch articles by trade type
    for (const complexNumber of allComplexNumbers) {
      for (const tradeType of tradeTypes) {
        const articles = await fetchArticlesByComplex(
          complexNumber,
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
                naverUrl: `https://fin.land.naver.com/complexes/${complexNumber}?tab=article`,
              },
            });
            newListings++;
          }
        }

        await new Promise((r) => setTimeout(r, 2000));
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
  try {
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
  } finally {
    await closeBrowser();
  }

  return results;
}
