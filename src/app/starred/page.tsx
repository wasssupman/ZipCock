"use client";

import { useState, useEffect, useMemo } from "react";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import { formatPrice, formatDate, formatConfirmDate } from "@/lib/format";
import { PriceBadge, InfraBadge } from "@/components/level-badge";
import StarButton from "@/components/star-button";

interface StarredItem {
  id: number;
  listingId: number;
  createdAt: string;
  listing: {
    id: number;
    buildingName: string | null;
    propertyType: string;
    tradeType: string;
    price: number;
    rentPrice: number | null;
    area: number | null;
    floor: string | null;
    description: string | null;
    address: string | null;
    naverUrl: string | null;
    priceLevel: string | null;
    infraLevel: string | null;
    aiAnalysis: string | null;
    articleConfirmDate: string | null;
    firstSeenAt: string;
    isActive: boolean;
    region: { id: number; name: string };
  };
}

const propertyLabels = PROPERTY_TYPES as Record<string, string>;
const tradeLabels = TRADE_TYPES as Record<string, string>;

export default function StarredPage() {
  const [items, setItems] = useState<StarredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");

  useEffect(() => {
    fetch("/api/starred")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (propertyFilter) {
      list = list.filter((i) => i.listing.propertyType === propertyFilter);
    }
    if (tradeFilter) {
      list = list.filter((i) => i.listing.tradeType === tradeFilter);
    }
    return list;
  }, [items, propertyFilter, tradeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, StarredItem[]>();
    for (const item of filtered) {
      const regionName = item.listing.region.name;
      if (!map.has(regionName)) map.set(regionName, []);
      map.get(regionName)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleUnstar = (listingId: number) => {
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  };

  const propertyTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) types.add(item.listing.propertyType);
    return Array.from(types);
  }, [items]);

  const tradeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) types.add(item.listing.tradeType);
    return Array.from(types);
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          관심 매물
        </h1>
        <p className="mt-1 text-sm text-muted">
          {items.length > 0
            ? `관심 매물 ${items.length}건`
            : "관심 매물이 없습니다"}
        </p>
      </div>

      {items.length > 0 && (
        <div className="animate-fade-in flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-[140px] flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-muted">
              매물 유형
            </label>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">전체</option>
              {propertyTypes.map((type) => (
                <option key={type} value={type}>
                  {propertyLabels[type] || type}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1 sm:flex-none">
            <label className="mb-1 block text-xs font-medium text-muted">
              거래 유형
            </label>
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">전체</option>
              {tradeTypes.map((type) => (
                <option key={type} value={type}>
                  {tradeLabels[type] || type}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted">
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          로딩 중...
        </div>
      ) : items.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-border bg-card py-20 text-center text-sm text-muted">
          관심 매물이 없습니다
          <p className="mt-2 text-xs">
            매물 목록에서 별표를 눌러 관심 매물을 등록하세요
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-border bg-card py-20 text-center text-sm text-muted">
          필터 조건에 맞는 관심 매물이 없습니다
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([regionName, regionItems]) => (
            <div
              key={regionName}
              className="animate-fade-in rounded-xl border border-border bg-card"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {regionName}
                  </h2>
                  <span className="text-xs text-muted">
                    <span className="font-medium text-zinc-700">
                      {regionItems.length}
                    </span>
                    건
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-zinc-100">
                {regionItems.map((item) => (
                  <StarredListingRow
                    key={item.id}
                    item={item}
                    onUnstar={handleUnstar}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StarredListingRow({
  item,
  onUnstar,
}: {
  item: StarredItem;
  onUnstar: (listingId: number) => void;
}) {
  const listing = item.listing;

  const inner = (
    <>
      <div onClick={() => onUnstar(listing.id)}>
        <StarButton listingId={listing.id} initialStarred={true} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-zinc-900">
            {listing.buildingName || "매물"}
          </p>
          {!listing.isActive && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
              비활성
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {propertyLabels[listing.propertyType] || listing.propertyType}
          {" / "}
          {tradeLabels[listing.tradeType] || listing.tradeType}
          {listing.area ? ` / ${listing.area}m²` : ""}
          {listing.floor ? ` / ${listing.floor}층` : ""}
          {listing.description ? ` / ${listing.description}` : ""}
        </p>
        {listing.address && (
          <p className="mt-0.5 text-xs text-zinc-500">{listing.address}</p>
        )}
        {(listing.priceLevel || listing.infraLevel) && (
          <div
            className="mt-1 flex gap-1"
            title={listing.aiAnalysis || undefined}
          >
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
          {formatDate(listing.firstSeenAt)}
          {listing.articleConfirmDate && (
            <span className="ml-1 text-zinc-400">
              (등록 {formatConfirmDate(listing.articleConfirmDate)})
            </span>
          )}
        </p>
      </div>
    </>
  );

  return listing.naverUrl ? (
    <li>
      <a
        href={listing.naverUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50"
      >
        {inner}
      </a>
    </li>
  ) : (
    <li className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50">
      {inner}
    </li>
  );
}
