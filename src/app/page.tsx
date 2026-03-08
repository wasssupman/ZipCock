import { prisma } from "@/lib/prisma";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import { formatPrice, formatDate } from "@/lib/format";
import CrawlButton from "@/components/crawl-button";
import { PriceBadge, InfraBadge } from "@/components/level-badge";

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

  // Determine top 5 regions by active listing count
  const regionCountMap = new Map(
    listingsByRegion.map((g) => [g.regionId, g._count])
  );
  const top5Regions = activeRegions
    .map((r) => ({ ...r, totalListings: regionCountMap.get(r.id) || 0 }))
    .filter((r) => r.totalListings > 0)
    .sort((a, b) => b.totalListings - a.totalListings)
    .slice(0, 5);

  const top5Ids = top5Regions.map((r) => r.id);

  // Fetch new and deactivated listings for top 5 regions
  const [newListingsAll, deactivatedListingsAll] = await Promise.all([
    prisma.listing.findMany({
      where: {
        isActive: true,
        firstSeenAt: { gte: oneDayAgo },
        regionId: { in: top5Ids },
      },
      orderBy: { firstSeenAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
    prisma.listing.findMany({
      where: {
        isActive: false,
        updatedAt: { gte: oneDayAgo },
        regionId: { in: top5Ids },
      },
      orderBy: { updatedAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
  ]);

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
      <div className="flex items-end justify-between">
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="모니터링 지역"
          value={regionCount}
          unit="개"
          className="animate-fade-in"
        />
        <StatCard
          label="총 매물"
          value={listingCount}
          unit="건"
          className="animate-fade-in animate-fade-in-delay-1"
        />
        <StatCard
          label="24h 신규"
          value={recentCount}
          unit="건"
          accent
          className="animate-fade-in animate-fade-in-delay-2"
        />
        <StatCard
          label="24h 사라진 매물"
          value={deactivatedCount}
          unit="건"
          className="animate-fade-in animate-fade-in-delay-3"
        />
      </div>

      {/* Last crawl status */}
      {lastCrawl && (
        <div className="animate-fade-in animate-fade-in-delay-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-zinc-900">
            마지막 크롤링
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <span>
              시간:{" "}
              <span className="text-zinc-700">
                {formatDate(lastCrawl.startedAt.toISOString())}
              </span>
            </span>
            <span>
              상태:{" "}
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
            </span>
            <span>
              발견: <span className="text-zinc-700">{lastCrawl.totalFound}건</span>
            </span>
            <span>
              신규: <span className="text-zinc-700">{lastCrawl.newListings}건</span>
            </span>
          </div>
        </div>
      )}

      {/* Region sections */}
      {top5Regions.map((region) => {
        const newListings = newByRegion.get(region.id) || [];
        const deactivatedListings = deactivatedByRegion.get(region.id) || [];
        const regionDisplayName = region.parent
          ? `${region.name} (${region.parent.name})`
          : region.name;

        return (
          <RegionSection
            key={region.id}
            name={regionDisplayName}
            totalListings={region.totalListings}
            newCount={newListings.length}
            deactivatedCount={deactivatedListings.length}
            newListings={newListings}
            deactivatedListings={deactivatedListings}
            propertyLabels={propertyLabels}
            tradeLabels={tradeLabels}
          />
        );
      })}

      {top5Regions.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted">
          아직 수집된 매물이 없습니다
        </div>
      )}
    </div>
  );
}

function RegionSection({
  name,
  totalListings,
  newCount,
  deactivatedCount,
  newListings,
  deactivatedListings,
  propertyLabels,
  tradeLabels,
}: {
  name: string;
  totalListings: number;
  newCount: number;
  deactivatedCount: number;
  newListings: {
    id: number;
    buildingName: string | null;
    propertyType: string;
    tradeType: string;
    price: number;
    rentPrice: number | null;
    area: number | null;
    floor: string | null;
    description: string | null;
    priceLevel: string | null;
    infraLevel: string | null;
    aiAnalysis: string | null;
    firstSeenAt: Date;
    region: { name: string };
  }[];
  deactivatedListings: {
    id: number;
    buildingName: string | null;
    propertyType: string;
    tradeType: string;
    price: number;
    rentPrice: number | null;
    area: number | null;
    floor: string | null;
    updatedAt: Date;
    region: { name: string };
  }[];
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
}) {
  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card">
      {/* Region header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            📍 {name}
          </h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>총 <span className="font-medium text-zinc-700">{totalListings.toLocaleString()}</span>건</span>
            <span>신규 <span className="font-medium text-blue-600">{newCount}</span>건</span>
            {deactivatedCount > 0 && (
              <span>사라진 <span className="font-medium text-red-500">{deactivatedCount}</span>건</span>
            )}
          </div>
        </div>
      </div>

      {/* New listings */}
      {newListings.length > 0 ? (
        <ul className="divide-y divide-zinc-100">
          {newListings.map((listing) => (
            <li
              key={listing.id}
              className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-zinc-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {listing.buildingName || "매물"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {propertyLabels[listing.propertyType] || listing.propertyType}
                  {" / "}
                  {tradeLabels[listing.tradeType] || listing.tradeType}
                  {listing.area ? ` / ${listing.area}m²` : ""}
                  {listing.floor ? ` / ${listing.floor}층` : ""}
                  {listing.description ? ` / ${listing.description}` : ""}
                </p>
                {(listing.priceLevel || listing.infraLevel) && (
                  <div className="mt-1 flex gap-1" title={listing.aiAnalysis || undefined}>
                    <PriceBadge level={listing.priceLevel} />
                    <InfraBadge level={listing.infraLevel} />
                  </div>
                )}
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className="text-sm font-semibold text-blue-700">
                  {formatPrice(listing.price)}
                  {listing.rentPrice ? ` / ${formatPrice(listing.rentPrice)}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(listing.firstSeenAt.toISOString())}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-center text-xs text-muted">
          24시간 내 신규 매물 없음
        </div>
      )}

      {/* Deactivated listings */}
      {deactivatedListings.length > 0 && (
        <div className="border-t border-red-200 bg-red-50/30">
          <div className="border-b border-red-100 px-5 py-3">
            <h3 className="text-xs font-medium text-red-600">
              사라진 매물
              <span className="ml-1 font-normal text-muted">24시간 이내</span>
            </h3>
          </div>
          <ul className="divide-y divide-red-100">
            {deactivatedListings.map((listing) => (
              <li
                key={listing.id}
                className="flex items-center justify-between px-5 py-3.5 opacity-75"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-700">
                    {listing.buildingName || "매물"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {propertyLabels[listing.propertyType] || listing.propertyType}
                    {" / "}
                    {tradeLabels[listing.tradeType] || listing.tradeType}
                    {listing.area ? ` / ${listing.area}m²` : ""}
                    {listing.floor ? ` / ${listing.floor}층` : ""}
                  </p>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <p className="text-sm font-semibold text-zinc-500 line-through">
                    {formatPrice(listing.price)}
                  </p>
                  <p className="mt-0.5 text-xs text-red-500">
                    {formatDate(listing.updatedAt.toISOString())} 삭제
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  accent,
  className,
}: {
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 ${
        accent ? "border-blue-200 bg-primary-light" : "border-border"
      } ${className || ""}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold tracking-tight ${
          accent ? "text-blue-700" : "text-zinc-900"
        }`}
      >
        {value.toLocaleString()}
        <span className="ml-1 text-base font-medium text-muted">{unit}</span>
      </p>
    </div>
  );
}
