"use client";

import { useState, useEffect, useCallback } from "react";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";

interface Region {
  id: number;
  name: string;
}

interface AlertConfig {
  id: number;
  channel: string;
  webhookUrl: string | null;
  botToken: string | null;
  chatId: string | null;
  filterPropertyTypes: string | null;
  filterTradeTypes: string | null;
  filterMinPrice: number | null;
  filterMaxPrice: number | null;
  filterRegionIds: string | null;
  isActive: boolean;
  createdAt: string;
}

const propertyLabels = PROPERTY_TYPES as Record<string, string>;
const tradeLabels = TRADE_TYPES as Record<string, string>;

export default function AlertsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form state
  const [channel, setChannel] = useState<"discord" | "telegram">("discord");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);
  const [selectedTradeTypes, setSelectedTradeTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);

  const fetchAlerts = useCallback(async () => {
    const res = await fetch("/api/alerts");
    setAlerts(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then(setRegions);
    fetchAlerts();
  }, [fetchAlerts]);

  function togglePropertyType(code: string) {
    setSelectedPropertyTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleTradeType(code: string) {
    setSelectedTradeTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function toggleRegion(id: string) {
    setSelectedRegionIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        channel,
        isActive: true,
      };
      if (channel === "discord") {
        body.webhookUrl = webhookUrl;
      } else {
        body.botToken = botToken;
        body.chatId = chatId;
      }
      if (selectedPropertyTypes.length > 0)
        body.filterPropertyTypes = selectedPropertyTypes.join(",");
      if (selectedTradeTypes.length > 0)
        body.filterTradeTypes = selectedTradeTypes.join(",");
      if (minPrice) body.filterMinPrice = Number(minPrice);
      if (maxPrice) body.filterMaxPrice = Number(maxPrice);
      if (selectedRegionIds.length > 0)
        body.filterRegionIds = selectedRegionIds.join(",");

      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await fetchAlerts();
      // Reset form
      setWebhookUrl("");
      setBotToken("");
      setChatId("");
      setSelectedPropertyTypes([]);
      setSelectedTradeTypes([]);
      setMinPrice("");
      setMaxPrice("");
      setSelectedRegionIds([]);
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(alert: AlertConfig) {
    setTogglingId(alert.id);
    try {
      await fetch(`/api/alerts/${alert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !alert.isActive }),
      });
      await fetchAlerts();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      await fetchAlerts();
    } finally {
      setDeletingId(null);
    }
  }

  function summarizeFilters(alert: AlertConfig): string {
    const parts: string[] = [];
    if (alert.filterPropertyTypes) {
      parts.push(
        alert.filterPropertyTypes
          .split(",")
          .map((c) => propertyLabels[c] || c)
          .join(", ")
      );
    }
    if (alert.filterTradeTypes) {
      parts.push(
        alert.filterTradeTypes
          .split(",")
          .map((c) => tradeLabels[c] || c)
          .join(", ")
      );
    }
    if (alert.filterMinPrice != null || alert.filterMaxPrice != null) {
      const min = alert.filterMinPrice != null ? `${alert.filterMinPrice.toLocaleString()}만` : "";
      const max = alert.filterMaxPrice != null ? `${alert.filterMaxPrice.toLocaleString()}만` : "";
      parts.push(`${min}~${max}`);
    }
    if (alert.filterRegionIds) {
      const ids = alert.filterRegionIds.split(",");
      const names = ids
        .map((id) => regions.find((r) => r.id === Number(id))?.name)
        .filter(Boolean);
      if (names.length > 0) parts.push(names.join(", "));
    }
    return parts.length > 0 ? parts.join(" | ") : "필터 없음 (전체)";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          알림 설정
        </h1>
        <p className="mt-1 text-sm text-muted">
          새 매물 발견 시 알림을 받을 채널과 조건을 설정합니다
        </p>
      </div>

      {/* Create form */}
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6">
        <h2 className="mb-5 text-sm font-semibold text-zinc-900">
          새 알림 추가
        </h2>

        {/* Channel selection */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium text-muted">
            알림 채널
          </label>
          <div className="flex gap-3">
            {(["discord", "telegram"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  channel === ch
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {ch === "discord" ? "Discord" : "Telegram"}
              </button>
            ))}
          </div>
        </div>

        {/* Channel-specific inputs */}
        {channel === "discord" ? (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ) : (
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Bot Token
              </label>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Chat ID
              </label>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1001234567890"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        {/* Property type checkboxes */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium text-muted">
            매물 유형 필터
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROPERTY_TYPES).map(([code, label]) => (
              <label
                key={code}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedPropertyTypes.includes(code)
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPropertyTypes.includes(code)}
                  onChange={() => togglePropertyType(code)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-400">선택하지 않으면 전체</p>
        </div>

        {/* Trade type checkboxes */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium text-muted">
            거래 유형 필터
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TRADE_TYPES).map(([code, label]) => (
              <label
                key={code}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTradeTypes.includes(code)
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTradeTypes.includes(code)}
                  onChange={() => toggleTradeType(code)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              최소 가격 (만원)
            </label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              최대 가격 (만원)
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="제한 없음"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Region multi-select */}
        {regions.length > 0 && (
          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium text-muted">
              지역 필터
            </label>
            <div className="flex flex-wrap gap-2">
              {regions.map((region) => (
                <label
                  key={region.id}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedRegionIds.includes(String(region.id))
                      ? "border-primary bg-primary-light text-primary"
                      : "border-border text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRegionIds.includes(String(region.id))}
                    onChange={() => toggleRegion(String(region.id))}
                    className="sr-only"
                  />
                  {region.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-400">선택하지 않으면 전체</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || (channel === "discord" ? !webhookUrl : !botToken || !chatId)}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* Existing alerts */}
      <div className="animate-fade-in animate-fade-in-delay-1 rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            알림 목록
            <span className="ml-2 text-xs font-normal text-muted">
              {alerts.length}개
            </span>
          </h2>
        </div>
        {alerts.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            설정된 알림이 없습니다
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                        alert.channel === "discord"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {alert.channel === "discord" ? "Discord" : "Telegram"}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        alert.isActive
                          ? "bg-success-light text-success"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {alert.isActive ? "활성" : "비활성"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {summarizeFilters(alert)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleToggle(alert)}
                    disabled={togglingId === alert.id}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      alert.isActive
                        ? "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        : "border-blue-200 text-primary hover:bg-primary-light"
                    }`}
                  >
                    {alert.isActive ? "비활성화" : "활성화"}
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    disabled={deletingId === alert.id}
                    className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
