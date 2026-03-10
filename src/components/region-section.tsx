"use client";

import { useState, useMemo } from "react";
import { formatPrice, formatDate, formatConfirmDate } from "@/lib/format";
import { PriceBadge, InfraBadge } from "@/components/level-badge";

const ITEMS_PER_PAGE = 5;

interface NewListing {
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
  region: { name: string };
}

interface DeactivatedListing {
  id: number;
  buildingName: string | null;
  propertyType: string;
  tradeType: string;
  price: number;
  rentPrice: number | null;
  area: number | null;
  floor: string | null;
  address: string | null;
  naverUrl: string | null;
  updatedAt: string;
  region: { name: string };
}

function getPropertyTabs(
  listings: { propertyType: string }[],
  labels: Record<string, string>
): { key: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of listings) {
    counts.set(l.propertyType, (counts.get(l.propertyType) || 0) + 1);
  }
  return [
    { key: "all", label: "전체", count: listings.length },
    ...Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: labels[key] || key,
        count,
      })),
  ];
}

export default function RegionSection({
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
  newListings: NewListing[];
  deactivatedListings: DeactivatedListing[];
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
}) {
  const [newTab, setNewTab] = useState("all");
  const [newPage, setNewPage] = useState(1);
  const [deactivatedTab, setDeactivatedTab] = useState("all");
  const [deactivatedPage, setDeactivatedPage] = useState(1);

  const newTabs = useMemo(
    () => getPropertyTabs(newListings, propertyLabels),
    [newListings, propertyLabels]
  );
  const deactivatedTabs = useMemo(
    () => getPropertyTabs(deactivatedListings, propertyLabels),
    [deactivatedListings, propertyLabels]
  );

  const filteredNew = useMemo(
    () =>
      newTab === "all"
        ? newListings
        : newListings.filter((l) => l.propertyType === newTab),
    [newListings, newTab]
  );
  const filteredDeactivated = useMemo(
    () =>
      deactivatedTab === "all"
        ? deactivatedListings
        : deactivatedListings.filter((l) => l.propertyType === deactivatedTab),
    [deactivatedListings, deactivatedTab]
  );

  const newTotalPages = Math.max(1, Math.ceil(filteredNew.length / ITEMS_PER_PAGE));
  const deactivatedTotalPages = Math.max(1, Math.ceil(filteredDeactivated.length / ITEMS_PER_PAGE));

  const pagedNew = filteredNew.slice(
    (newPage - 1) * ITEMS_PER_PAGE,
    newPage * ITEMS_PER_PAGE
  );
  const pagedDeactivated = filteredDeactivated.slice(
    (deactivatedPage - 1) * ITEMS_PER_PAGE,
    deactivatedPage * ITEMS_PER_PAGE
  );

  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card">
      {/* Region header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">{name}</h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>
              총{" "}
              <span className="font-medium text-zinc-700">
                {totalListings.toLocaleString()}
              </span>
              건
            </span>
            <span>
              신규{" "}
              <span className="font-medium text-blue-600">{newCount}</span>건
            </span>
            {deactivatedCount > 0 && (
              <span>
                사라진{" "}
                <span className="font-medium text-red-500">
                  {deactivatedCount}
                </span>
                건
              </span>
            )}
          </div>
        </div>
      </div>

      {/* New listings */}
      {newListings.length > 0 ? (
        <>
          {newTabs.length > 2 && (
            <TabBar
              tabs={newTabs}
              active={newTab}
              onChange={(key) => {
                setNewTab(key);
                setNewPage(1);
              }}
            />
          )}
          <ul className="divide-y divide-zinc-100">
            {pagedNew.map((listing) => (
              <NewListingRow
                key={listing.id}
                listing={listing}
                propertyLabels={propertyLabels}
                tradeLabels={tradeLabels}
              />
            ))}
          </ul>
          {newTotalPages > 1 && (
            <Paginator
              current={newPage}
              total={newTotalPages}
              onChange={setNewPage}
            />
          )}
        </>
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
          {deactivatedTabs.length > 2 && (
            <TabBar
              tabs={deactivatedTabs}
              active={deactivatedTab}
              onChange={(key) => {
                setDeactivatedTab(key);
                setDeactivatedPage(1);
              }}
              variant="danger"
            />
          )}
          <ul className="divide-y divide-red-100">
            {pagedDeactivated.map((listing) => (
              <DeactivatedListingRow
                key={listing.id}
                listing={listing}
                propertyLabels={propertyLabels}
                tradeLabels={tradeLabels}
              />
            ))}
          </ul>
          {deactivatedTotalPages > 1 && (
            <Paginator
              current={deactivatedPage}
              total={deactivatedTotalPages}
              onChange={setDeactivatedPage}
              variant="danger"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
  variant = "default",
}: {
  tabs: { key: string; label: string; count: number }[];
  active: string;
  onChange: (key: string) => void;
  variant?: "default" | "danger";
}) {
  const activeClass =
    variant === "danger"
      ? "border-red-500 text-red-600"
      : "border-blue-500 text-blue-600";
  const inactiveClass =
    variant === "danger"
      ? "border-transparent text-zinc-400 hover:text-red-400"
      : "border-transparent text-zinc-400 hover:text-zinc-600";

  return (
    <div className="flex gap-0 overflow-x-auto border-b border-zinc-100 px-5">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
            active === tab.key ? activeClass : inactiveClass
          }`}
        >
          {tab.label}
          <span className="ml-1 text-[10px] opacity-60">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

function NewListingRow({
  listing,
  propertyLabels,
  tradeLabels,
}: {
  listing: NewListing;
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
}) {
  const inner = (
    <>
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
        className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-zinc-50"
      >
        {inner}
      </a>
    </li>
  ) : (
    <li className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-zinc-50">
      {inner}
    </li>
  );
}

function DeactivatedListingRow({
  listing,
  propertyLabels,
  tradeLabels,
}: {
  listing: DeactivatedListing;
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
}) {
  const inner = (
    <>
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
        {listing.address && (
          <p className="mt-0.5 text-xs text-zinc-500">{listing.address}</p>
        )}
      </div>
      <div className="ml-4 shrink-0 text-right">
        <p className="text-sm font-semibold text-zinc-500 line-through">
          {formatPrice(listing.price)}
        </p>
        <p className="mt-0.5 text-xs text-red-500">
          {formatDate(listing.updatedAt)} 삭제
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
        className="flex items-center justify-between px-5 py-3.5 opacity-75 transition-colors hover:bg-red-50"
      >
        {inner}
      </a>
    </li>
  ) : (
    <li className="flex items-center justify-between px-5 py-3.5 opacity-75">
      {inner}
    </li>
  );
}

function Paginator({
  current,
  total,
  onChange,
  variant = "default",
}: {
  current: number;
  total: number;
  onChange: (page: number) => void;
  variant?: "default" | "danger";
}) {
  const borderColor =
    variant === "danger" ? "border-red-100" : "border-border";

  return (
    <div
      className={`flex items-center justify-center gap-2 border-t ${borderColor} px-5 py-3`}
    >
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current <= 1}
        className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-40"
      >
        이전
      </button>
      <span className="text-xs text-muted">
        {current} / {total}
      </span>
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current >= total}
        className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-40"
      >
        다음
      </button>
    </div>
  );
}
