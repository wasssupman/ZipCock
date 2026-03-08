"use client";

import { useState, useEffect, useCallback } from "react";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import { formatPrice, formatDate } from "@/lib/format";
import { PriceBadge, InfraBadge } from "@/components/level-badge";

interface Region {
  id: number;
  name: string;
}

interface Listing {
  id: number;
  naverArticleId: string;
  buildingName: string | null;
  propertyType: string;
  tradeType: string;
  price: number;
  rentPrice: number | null;
  area: number | null;
  floor: string | null;
  description: string | null;
  naverUrl: string | null;
  priceLevel: string | null;
  infraLevel: string | null;
  aiAnalysis: string | null;
  firstSeenAt: string;
  region: { name: string };
}

const SORT_OPTIONS = [
  { value: "firstSeenAt", label: "최신순" },
  { value: "price", label: "가격순" },
  { value: "area", label: "면적순" },
];

const propertyLabels = PROPERTY_TYPES as Record<string, string>;
const tradeLabels = TRADE_TYPES as Record<string, string>;

export default function ListingsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [regionId, setRegionId] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [sort, setSort] = useState("firstSeenAt");
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then(setRegions);
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (regionId) params.set("regionId", regionId);
    if (propertyType) params.set("propertyType", propertyType);
    if (tradeType) params.set("tradeType", tradeType);
    params.set("sort", sort);
    params.set("order", sort === "price" || sort === "area" ? "asc" : "desc");
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await fetch(`/api/listings?${params}`);
    const data = await res.json();
    setListings(data.listings);
    setTotal(data.total);
    setLoading(false);
  }, [regionId, propertyType, tradeType, sort, page]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [regionId, propertyType, tradeType, sort]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          매물 목록
        </h1>
        <p className="mt-1 text-sm text-muted">
          수집된 네이버 부동산 매물 {total.toLocaleString()}건
        </p>
      </div>

      {/* Filter bar */}
      <div className="animate-fade-in flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <FilterSelect
          label="지역"
          value={regionId}
          onChange={setRegionId}
          options={regions.map((r) => ({ value: String(r.id), label: r.name }))}
          placeholder="전체"
        />
        <FilterSelect
          label="매물 유형"
          value={propertyType}
          onChange={setPropertyType}
          options={Object.entries(PROPERTY_TYPES).map(([k, v]) => ({
            value: k,
            label: v,
          }))}
          placeholder="전체"
        />
        <FilterSelect
          label="거래 유형"
          value={tradeType}
          onChange={setTradeType}
          options={Object.entries(TRADE_TYPES).map(([k, v]) => ({
            value: k,
            label: v,
          }))}
          placeholder="전체"
        />
        <FilterSelect
          label="정렬"
          value={sort}
          onChange={setSort}
          options={SORT_OPTIONS}
        />
      </div>

      {/* Listings */}
      <div className="animate-fade-in animate-fade-in-delay-1 rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted">
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            로딩 중...
          </div>
        ) : listings.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted">
            조건에 맞는 매물이 없습니다
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted sm:grid sm:grid-cols-12 sm:gap-4">
              <div className="col-span-4">매물정보</div>
              <div className="col-span-2">유형</div>
              <div className="col-span-2 text-right">가격</div>
              <div className="col-span-2 text-right">면적/층</div>
              <div className="col-span-2 text-right">등록일</div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="px-5 py-4 transition-colors hover:bg-zinc-50 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  {/* Building info */}
                  <div className="col-span-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {listing.buildingName || "매물"}
                      </p>
                      {listing.naverUrl && (
                        <a
                          href={listing.naverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted transition-colors hover:text-primary"
                          title="네이버 부동산에서 보기"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{listing.region.name}</p>
                  </div>
                  {/* Type */}
                  <div className="col-span-2 mt-2 sm:mt-0">
                    <div className="flex gap-1.5">
                      <span className="inline-flex rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        {propertyLabels[listing.propertyType] || listing.propertyType}
                      </span>
                      <span className="inline-flex rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                        {tradeLabels[listing.tradeType] || listing.tradeType}
                      </span>
                    </div>
                    {(listing.priceLevel || listing.infraLevel) && (
                      <div className="mt-1 flex gap-1" title={listing.aiAnalysis || undefined}>
                        <PriceBadge level={listing.priceLevel} />
                        <InfraBadge level={listing.infraLevel} />
                      </div>
                    )}
                  </div>
                  {/* Price */}
                  <div className="col-span-2 mt-2 text-right sm:mt-0">
                    <p className="text-sm font-semibold text-blue-700">
                      {formatPrice(listing.price)}
                    </p>
                    {listing.rentPrice ? (
                      <p className="text-xs text-muted">
                        / {formatPrice(listing.rentPrice)}
                      </p>
                    ) : null}
                  </div>
                  {/* Area / Floor / Direction */}
                  <div className="col-span-2 mt-1 text-right text-sm text-zinc-700 sm:mt-0">
                    {listing.area ? `${listing.area}m²` : "-"}
                    {listing.floor ? (
                      <span className="ml-1 text-muted">/ {listing.floor}</span>
                    ) : null}
                    {listing.description ? (
                      <span className="ml-1 text-xs text-muted" title={listing.description}>/ {listing.description.slice(0, 20)}</span>
                    ) : null}
                  </div>
                  {/* Date */}
                  <div className="col-span-2 mt-1 text-right text-xs text-muted sm:mt-0">
                    {formatDate(listing.firstSeenAt)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            이전
          </button>
          <span className="px-3 text-sm text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="min-w-[140px] flex-1 sm:flex-none">
      <label className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
