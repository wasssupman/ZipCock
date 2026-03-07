"use client";

import { useState, useEffect, useCallback } from "react";
import { cortarTypeLabel } from "@/lib/format";

interface NaverRegion {
  cortarNo: string;
  cortarName: string;
  cortarType: string;
}

interface ActiveRegion {
  id: number;
  name: string;
  cortarNo: string;
  cortarType: string;
  createdAt: string;
}

export default function RegionsPage() {
  const [sidoList, setSidoList] = useState<NaverRegion[]>([]);
  const [sigunguList, setSigunguList] = useState<NaverRegion[]>([]);
  const [dongList, setDongList] = useState<NaverRegion[]>([]);

  const [selectedSido, setSelectedSido] = useState<NaverRegion | null>(null);
  const [selectedSigungu, setSelectedSigungu] = useState<NaverRegion | null>(null);
  const [selectedDong, setSelectedDong] = useState<NaverRegion | null>(null);

  const [activeRegions, setActiveRegions] = useState<ActiveRegion[]>([]);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchActiveRegions = useCallback(async () => {
    const res = await fetch("/api/regions");
    const data = await res.json();
    setActiveRegions(data);
  }, []);

  // Load 시/도 on mount
  useEffect(() => {
    fetch("/api/regions/naver?cortarNo=0000000000")
      .then((r) => r.json())
      .then((d) => setSidoList(d.cortarList || []));
    fetchActiveRegions();
  }, [fetchActiveRegions]);

  function handleSidoChange(cortarNo: string) {
    const region = sidoList.find((r) => r.cortarNo === cortarNo) || null;
    setSelectedSido(region);
    setSelectedSigungu(null);
    setSelectedDong(null);
    setSigunguList([]);
    setDongList([]);
    if (region) {
      fetch(`/api/regions/naver?cortarNo=${cortarNo}`)
        .then((r) => r.json())
        .then((d) => setSigunguList(d.cortarList || []));
    }
  }

  function handleSigunguChange(cortarNo: string) {
    const region = sigunguList.find((r) => r.cortarNo === cortarNo) || null;
    setSelectedSigungu(region);
    setSelectedDong(null);
    setDongList([]);
    if (region) {
      fetch(`/api/regions/naver?cortarNo=${cortarNo}`)
        .then((r) => r.json())
        .then((d) => setDongList(d.cortarList || []));
    }
  }

  function handleDongChange(cortarNo: string) {
    const region = dongList.find((r) => r.cortarNo === cortarNo) || null;
    setSelectedDong(region);
  }

  // The most specific selection is the one to add
  function getSelectedRegion(): NaverRegion | null {
    return selectedDong || selectedSigungu || selectedSido;
  }

  async function handleAdd() {
    const region = getSelectedRegion();
    if (!region) return;
    setAdding(true);
    try {
      await fetch("/api/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: region.cortarName,
          cortarNo: region.cortarNo,
          cortarType: region.cortarType,
        }),
      });
      await fetchActiveRegions();
    } catch {
      // silently handle
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/regions/${id}`, { method: "DELETE" });
      await fetchActiveRegions();
    } catch {
      // silently handle
    } finally {
      setDeletingId(null);
    }
  }

  const selected = getSelectedRegion();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          지역 관리
        </h1>
        <p className="mt-1 text-sm text-muted">
          모니터링할 지역을 추가하거나 제거합니다
        </p>
      </div>

      {/* Region selector */}
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          지역 선택
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              시/도
            </label>
            <select
              value={selectedSido?.cortarNo || ""}
              onChange={(e) => handleSidoChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">선택하세요</option>
              {sidoList.map((r) => (
                <option key={r.cortarNo} value={r.cortarNo}>
                  {r.cortarName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              시/군/구
            </label>
            <select
              value={selectedSigungu?.cortarNo || ""}
              onChange={(e) => handleSigunguChange(e.target.value)}
              disabled={!selectedSido}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
            >
              <option value="">선택하세요</option>
              {sigunguList.map((r) => (
                <option key={r.cortarNo} value={r.cortarNo}>
                  {r.cortarName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              읍/면/동
            </label>
            <select
              value={selectedDong?.cortarNo || ""}
              onChange={(e) => handleDongChange(e.target.value)}
              disabled={!selectedSigungu}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
            >
              <option value="">선택하세요</option>
              {dongList.map((r) => (
                <option key={r.cortarNo} value={r.cortarNo}>
                  {r.cortarName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selected && (
          <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
            <span className="text-sm text-zinc-700">
              선택: <span className="font-medium">{selected.cortarName}</span>
              <span className="ml-1.5 inline-flex rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-muted">
                {cortarTypeLabel(selected.cortarType)}
              </span>
            </span>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {adding ? "추가 중..." : "추가"}
            </button>
          </div>
        )}
      </div>

      {/* Active regions list */}
      <div className="animate-fade-in animate-fade-in-delay-1 rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            활성 모니터링 지역
            <span className="ml-2 text-xs font-normal text-muted">
              {activeRegions.length}개
            </span>
          </h2>
        </div>
        {activeRegions.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            모니터링 중인 지역이 없습니다. 위에서 지역을 추가하세요.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {activeRegions.map((region) => (
              <li
                key={region.id}
                className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-zinc-50"
              >
                <div>
                  <span className="text-sm font-medium text-zinc-900">
                    {region.name}
                  </span>
                  <span className="ml-2 inline-flex rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-muted">
                    {cortarTypeLabel(region.cortarType)}
                  </span>
                  <span className="ml-2 font-mono text-xs text-zinc-400">
                    {region.cortarNo}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(region.id)}
                  disabled={deletingId === region.id}
                  className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-light disabled:opacity-50"
                >
                  {deletingId === region.id ? "삭제 중..." : "삭제"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
