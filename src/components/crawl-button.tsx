"use client";

import { useState, useCallback } from "react";

interface Progress {
  regionName?: string;
  complexName?: string;
  regionCurrent?: number;
  regionTotal?: number;
  complexCurrent?: number;
  complexTotal?: number;
}

export default function CrawlButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({});

  const handleCrawl = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setProgress({});

    const es = new EventSource("/api/crawl/stream");

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        switch (event.type) {
          case "crawl:start":
            setProgress({ regionTotal: event.totalRegions });
            break;
          case "crawl:region":
            setProgress((p) => ({
              ...p,
              regionName: event.regionName,
              regionCurrent: event.current,
              regionTotal: event.total,
              complexCurrent: undefined,
              complexTotal: undefined,
              complexName: undefined,
            }));
            break;
          case "crawl:complex":
            setProgress((p) => ({
              ...p,
              complexName: event.complexName,
              complexCurrent: event.current,
              complexTotal: event.total,
            }));
            break;
          case "crawl:region_done":
            setProgress((p) => ({
              ...p,
              complexName: undefined,
              complexCurrent: undefined,
              complexTotal: undefined,
            }));
            break;
          case "crawl:complete":
            es.close();
            setResult(`완료 (${event.results?.length ?? 0}개 지역 처리)`);
            setLoading(false);
            setTimeout(() => window.location.reload(), 1500);
            break;
          case "crawl:error":
            es.close();
            setResult(`오류: ${event.message}`);
            setLoading(false);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Only set error if we haven't received a complete event
      setLoading((prev) => {
        if (prev) {
          setResult("SSE 연결 오류");
        }
        return false;
      });
    };
  }, []);

  return (
    <div className="flex items-center gap-3">
      {loading && progress.regionName && (
        <span className="text-xs text-muted-foreground">
          {progress.regionCurrent}/{progress.regionTotal}{" "}
          {progress.regionName}
          {progress.complexName && (
            <>
              {" "}
              — {progress.complexCurrent}/{progress.complexTotal}{" "}
              {progress.complexName}
            </>
          )}
        </span>
      )}
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
