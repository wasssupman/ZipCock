import { prisma } from "@/lib/prisma";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import { formatDate } from "@/lib/format";
import CrawlButton from "@/components/crawl-button";
import AutoRefresh from "@/components/auto-refresh";
import RegionAccordion from "@/components/region-accordion";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    regionCount,
    listingCount,
    recentCount,
    lastCrawl,
    deactivatedCount,
    activeRegions,
    listingsByRegion,
  ] = await Promise.all([
    prisma.region.count({ where: { isActive: true } }),
    prisma.listing.count({ where: { isActive: true } }),
    prisma.listing.count({
      where: { isActive: true, firstSeenAt: { gte: oneDayAgo } },
    }),
    prisma.crawlLog.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.listing.count({
      where: { isActive: false, updatedAt: { gte: oneDayAgo } },
    }),
    prisma.region.findMany({
      where: { isActive: true },
      include: { parent: { select: { name: true } } },
    }),
    prisma.listing.groupBy({
      by: ["regionId"],
      where: { isActive: true },
      _count: true,
    }),
  ]);

  // Sort all regions by active listing count
  const regionCountMap = new Map(
    listingsByRegion.map((g) => [g.regionId, g._count])
  );
  const allSortedRegions = activeRegions
    .map((r) => ({ ...r, totalListings: regionCountMap.get(r.id) || 0 }))
    .sort((a, b) => b.totalListings - a.totalListings);

  const allRegionIds = allSortedRegions.map((r) => r.id);

  // Fetch new and deactivated listings for all regions
  const [newListingsAll, deactivatedListingsAll, starredListings] = await Promise.all([
    prisma.listing.findMany({
      where: {
        isActive: true,
        firstSeenAt: { gte: oneDayAgo },
        regionId: { in: allRegionIds },
      },
      orderBy: { firstSeenAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
    prisma.listing.findMany({
      where: {
        isActive: false,
        updatedAt: { gte: oneDayAgo },
        regionId: { in: allRegionIds },
      },
      orderBy: { updatedAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
    prisma.starredListing.findMany({ select: { listingId: true } }),
  ]);

  const starredIdList = starredListings.map((s) => s.listingId);

  // Group by regionId
  const newByRegion = new Map<number, typeof newListingsAll>();
  for (const l of newListingsAll) {
    const arr = newByRegion.get(l.regionId) || [];
    arr.push(l);
    newByRegion.set(l.regionId, arr);
  }

  const deactivatedByRegion = new Map<number, typeof deactivatedListingsAll>();
  for (const l of deactivatedListingsAll) {
    const arr = deactivatedByRegion.get(l.regionId) || [];
    arr.push(l);
    deactivatedByRegion.set(l.regionId, arr);
  }

  const propertyLabels = PROPERTY_TYPES as Record<string, string>;
  const tradeLabels = TRADE_TYPES as Record<string, string>;

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            대시보드
          </h1>
          <p className="mt-1 text-sm text-muted">
            네이버 부동산 매물 모니터링 현황
          </p>
        </div>
        <CrawlButton />
      </div>

      {/* Stats bar + last crawl */}
      <div className="animate-fade-in rounded-xl border border-border bg-card px-5 py-4">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
          <span className="text-sm text-muted">
            지역{" "}
            <span className="font-semibold text-zinc-900">{regionCount}</span>
            <span className="text-xs text-muted">개</span>
          </span>
          <span className="hidden sm:inline text-zinc-200">|</span>
          <span className="text-sm text-muted">
            총 매물{" "}
            <span className="font-semibold text-zinc-900">{listingCount.toLocaleString()}</span>
            <span className="text-xs text-muted">건</span>
          </span>
          <span className="hidden sm:inline text-zinc-200">|</span>
          <span className="text-sm text-muted">
            24h 신규{" "}
            <span className="font-semibold text-blue-600">{recentCount}</span>
            <span className="text-xs text-muted">건</span>
          </span>
          {deactivatedCount > 0 && (
            <>
              <span className="hidden sm:inline text-zinc-200">|</span>
              <span className="text-sm text-muted">
                24h 사라진{" "}
                <span className="font-semibold text-red-500">{deactivatedCount}</span>
                <span className="text-xs text-muted">건</span>
              </span>
            </>
          )}
        </div>
        {lastCrawl && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted">
            <span>
              마지막 크롤링{" "}
              <span className="text-zinc-700">
                {formatDate(lastCrawl.startedAt.toISOString())}
              </span>
            </span>
            <span
              className={
                lastCrawl.status === "success"
                  ? "font-medium text-success"
                  : lastCrawl.status === "running"
                    ? "font-medium text-blue-600"
                    : "font-medium text-danger"
              }
            >
              {lastCrawl.status === "success"
                ? "완료"
                : lastCrawl.status === "running"
                  ? "진행중"
                  : "오류"}
            </span>
            <span>
              발견 <span className="text-zinc-700">{lastCrawl.totalFound}</span> / 신규 <span className="text-zinc-700">{lastCrawl.newListings}</span>
            </span>
          </div>
        )}
      </div>

      {/* Region sections — accordion */}
      {allSortedRegions.length > 0 ? (
        <RegionAccordion
          regions={allSortedRegions.map((region) => {
            const newListings = newByRegion.get(region.id) || [];
            const deactivatedListings = deactivatedByRegion.get(region.id) || [];
            const regionDisplayName = region.parent
              ? `${region.name} (${region.parent.name})`
              : region.name;

            return {
              id: region.id,
              name: regionDisplayName,
              totalListings: region.totalListings,
              newCount: newListings.length,
              deactivatedCount: deactivatedListings.length,
              newListings: newListings.map((l) => ({
                id: l.id,
                buildingName: l.buildingName,
                propertyType: l.propertyType,
                tradeType: l.tradeType,
                price: l.price,
                rentPrice: l.rentPrice,
                area: l.area,
                floor: l.floor,
                description: l.description,
                address: l.address,
                naverUrl: l.naverUrl,
                priceLevel: l.priceLevel,
                infraLevel: l.infraLevel,
                aiAnalysis: l.aiAnalysis,
                articleConfirmDate: l.articleConfirmDate,
                firstSeenAt: l.firstSeenAt.toISOString(),
                region: l.region,
              })),
              deactivatedListings: deactivatedListings.map((l) => ({
                id: l.id,
                buildingName: l.buildingName,
                propertyType: l.propertyType,
                tradeType: l.tradeType,
                price: l.price,
                rentPrice: l.rentPrice,
                area: l.area,
                floor: l.floor,
                address: l.address,
                naverUrl: l.naverUrl,
                updatedAt: l.updatedAt.toISOString(),
                region: l.region,
              })),
            };
          })}
          propertyLabels={propertyLabels}
          tradeLabels={tradeLabels}
          starredIdList={starredIdList}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted">
          아직 수집된 매물이 없습니다
        </div>
      )}
    </div>
  );
}

