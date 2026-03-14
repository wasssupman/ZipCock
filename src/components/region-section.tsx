"use client";

import { useState, useMemo } from "react";
import { formatPrice, formatDate, formatConfirmDate } from "@/lib/format";
import { PriceBadge, InfraBadge } from "@/components/level-badge";
import StarButton from "@/components/star-button";

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
  starredIds = new Set<number>(),
  collapsed = false,
  onToggle,
}: {
  name: string;
  totalListings: number;
  newCount: number;
  deactivatedCount: number;
  newListings: NewListing[];
  deactivatedListings: DeactivatedListing[];
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
  starredIds?: Set<number>;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const [newTab, setNewTab] = useState("all");
  const [newPage, setNewPage] = useState(1);
  const [newTradeFilters, setNewTradeFilters] = useState<Set<string>>(new Set());
  const [deactivatedTab, setDeactivatedTab] = useState("all");
  const [deactivatedPage, setDeactivatedPage] = useState(1);
  const [deactivatedTradeFilters, setDeactivatedTradeFilters] = useState<Set<string>>(new Set());

  const newTabs = useMemo(
    () => getPropertyTabs(newListings, propertyLabels),
    [newListings, propertyLabels]
  );
  const deactivatedTabs = useMemo(
    () => getPropertyTabs(deactivatedListings, propertyLabels),
    [deactivatedListings, propertyLabels]
  );

  const filteredNew = useMemo(() => {
    let list = newTab === "all"
      ? newListings
      : newListings.filter((l) => l.propertyType === newTab);
    if (newTradeFilters.size > 0) {
      list = list.filter((l) => newTradeFilters.has(l.tradeType));
    }
    return list;
  }, [newListings, newTab, newTradeFilters]);

  const filteredDeactivated = useMemo(() => {
    let list = deactivatedTab === "all"
      ? deactivatedListings
      : deactivatedListings.filter((l) => l.propertyType === deactivatedTab);
    if (deactivatedTradeFilters.size > 0) {
      list = list.filter((l) => deactivatedTradeFilters.has(l.tradeType));
    }
    return list;
  }, [deactivatedListings, deactivatedTab, deactivatedTradeFilters]);

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

  const newTradeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const l of newListings) types.add(l.tradeType);
    return Array.from(types);
  }, [newListings]);

  const deactivatedTradeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const l of deactivatedListings) types.add(l.tradeType);
    return Array.from(types);
  }, [deactivatedListings]);

  return (
    <div className="animate-fade-in rounded-xl border border-border bg-card">
      {/* Region header — clickable for accordion toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between ${
          collapsed ? "" : "border-b border-border"
        }`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
              collapsed ? "" : "rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-900">{name}</h2>
          {collapsed && newCount > 0 && (
            <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
        <div className="flex items-center gap-4 pl-6 text-xs text-muted sm:pl-0">
          <span>
            총{" "}
            <span className="font-medium text-zinc-700">
              {totalListings.toLocaleString()}
            </span>
            건
          </span>
          <span>
            신규{" "}
            <span className={`font-medium ${newCount > 0 ? "text-blue-600" : "text-zinc-400"}`}>{newCount}</span>건
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
      </button>

      {/* Collapsible body */}
      {collapsed ? null : (
      <>
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
          <TradeFilterCheckboxes
            tradeTypes={newTradeTypes}
            selected={newTradeFilters}
            onChange={(next) => { setNewTradeFilters(next); setNewPage(1); }}
            tradeLabels={tradeLabels}
          />
          <ul className="divide-y divide-zinc-100">
            {pagedNew.map((listing) => (
              <NewListingRow
                key={listing.id}
                listing={listing}
                propertyLabels={propertyLabels}
                tradeLabels={tradeLabels}
                starred={starredIds.has(listing.id)}
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
          <TradeFilterCheckboxes
            tradeTypes={deactivatedTradeTypes}
            selected={deactivatedTradeFilters}
            onChange={(next) => { setDeactivatedTradeFilters(next); setDeactivatedPage(1); }}
            tradeLabels={tradeLabels}
            variant="danger"
          />
          <ul className="divide-y divide-red-100">
            {pagedDeactivated.map((listing) => (
              <DeactivatedListingRow
                key={listing.id}
                listing={listing}
                propertyLabels={propertyLabels}
                tradeLabels={tradeLabels}
                starred={starredIds.has(listing.id)}
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
      </>
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
  starred,
}: {
  listing: NewListing;
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
  starred: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <StarButton listingId={listing.id} initialStarred={starred} />
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
      </div>
      <div className="shrink-0 pl-9 text-right sm:ml-auto sm:pl-0">
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
        className="flex flex-col gap-1 px-5 py-3.5 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-3"
      >
        {inner}
      </a>
    </li>
  ) : (
    <li className="flex flex-col gap-1 px-5 py-3.5 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-3">
      {inner}
    </li>
  );
}

function DeactivatedListingRow({
  listing,
  propertyLabels,
  tradeLabels,
  starred,
}: {
  listing: DeactivatedListing;
  propertyLabels: Record<string, string>;
  tradeLabels: Record<string, string>;
  starred: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <StarButton listingId={listing.id} initialStarred={starred} />
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
      </div>
      <div className="shrink-0 pl-9 text-right sm:ml-auto sm:pl-0">
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
        className="flex flex-col gap-1 px-5 py-3.5 opacity-75 transition-colors hover:bg-red-50 sm:flex-row sm:items-center sm:gap-3"
      >
        {inner}
      </a>
    </li>
  ) : (
    <li className="flex flex-col gap-1 px-5 py-3.5 opacity-75 sm:flex-row sm:items-center sm:gap-3">
      {inner}
    </li>
  );
}

function TradeFilterCheckboxes({
  tradeTypes,
  selected,
  onChange,
  tradeLabels,
  variant = "default",
}: {
  tradeTypes: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  tradeLabels: Record<string, string>;
  variant?: "default" | "danger";
}) {
  if (tradeTypes.length < 2) return null;

  const toggle = (type: string) => {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next);
  };

  const accentClass =
    variant === "danger"
      ? "border-red-300 bg-red-50 text-red-700"
      : "border-blue-300 bg-blue-50 text-blue-700";
  const defaultClass =
    variant === "danger"
      ? "border-zinc-200 text-zinc-500 hover:border-red-200"
      : "border-zinc-200 text-zinc-500 hover:border-zinc-300";

  return (
    <div className="flex flex-wrap gap-1.5 px-5 py-2">
      {tradeTypes.map((type) => {
        const active = selected.size === 0 || selected.has(type);
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              selected.has(type) ? accentClass : selected.size === 0 ? defaultClass : "border-zinc-100 text-zinc-300"
            }`}
          >
            {tradeLabels[type] || type}
          </button>
        );
      })}
    </div>
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
