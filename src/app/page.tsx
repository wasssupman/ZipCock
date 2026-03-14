import { prisma } from "@/lib/prisma";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import { formatDate } from "@/lib/format";
import CrawlButton from "@/components/crawl-button";
import RegionSection from "@/components/region-section";
import AutoRefresh from "@/components/auto-refresh";
import Link from "next/link";

export const dynamic = "force-dynamic";

const REGIONS_PER_PAGE = 5;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page) || 1);
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allSortedRegions.length / REGIONS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRegions = allSortedRegions.slice(
    (safePage - 1) * REGIONS_PER_PAGE,
    safePage * REGIONS_PER_PAGE
  );

  const pagedIds = pagedRegions.map((r) => r.id);

  // Fetch new and deactivated listings only for current page's regions
  const [newListingsAll, deactivatedListingsAll, starredListings] = await Promise.all([
    prisma.listing.findMany({
      where: {
        isActive: true,
        firstSeenAt: { gte: oneDayAgo },
        regionId: { in: pagedIds },
      },
      orderBy: { firstSeenAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
    prisma.listing.findMany({
      where: {
        isActive: false,
        updatedAt: { gte: oneDayAgo },
        regionId: { in: pagedIds },
      },
      orderBy: { updatedAt: "desc" },
      include: { region: { select: { name: true } } },
    }),
    prisma.starredListing.findMany({ select: { listingId: true } }),
  ]);

  const starredIds = new Set(starredListings.map((s) => s.listingId));

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
      {pagedRegions.map((region) => {
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
            newListings={newListings.map((l) => ({
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
            }))}
            deactivatedListings={deactivatedListings.map((l) => ({
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
            }))}
            propertyLabels={propertyLabels}
            tradeLabels={tradeLabels}
            starredIds={starredIds}
          />
        );
      })}

      {allSortedRegions.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted">
          아직 수집된 매물이 없습니다
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <PaginationLink page={safePage - 1} disabled={safePage <= 1}>
            이전
          </PaginationLink>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={p === 1 ? "/" : `/?page=${p}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  p === safePage
                    ? "bg-primary text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
          <PaginationLink page={safePage + 1} disabled={safePage >= totalPages}>
            다음
          </PaginationLink>
        </div>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-zinc-400">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={page === 1 ? "/" : `/?page=${page}`}
      className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      {children}
    </Link>
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
