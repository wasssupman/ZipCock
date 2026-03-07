"use client";

import { useState } from "react";

export default function CrawlButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCrawl() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/crawl", { method: "POST" });
      if (!res.ok) throw new Error("크롤링 실패");
      const data = await res.json();
      const count = data.results?.length ?? 0;
      setResult(`완료 (${count}개 지역 처리)`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setResult("오류 발생");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs font-medium text-success">{result}</span>
      )}
      <button
        onClick={handleCrawl}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? (
          <>
            <Spinner />
            크롤링 중...
          </>
        ) : (
          "수동 크롤링"
        )}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
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
  );
}
