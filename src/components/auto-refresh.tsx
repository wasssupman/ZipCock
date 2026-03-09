"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL = 30_000;

export default function AutoRefresh() {
  const router = useRouter();
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      try {
        const res = await fetch("/api/crawl/latest");
        if (!res.ok) return;
        const data = await res.json();
        const id = data.id as number | null;

        if (lastIdRef.current === null) {
          // First poll — just record the current state
          lastIdRef.current = id;
        } else if (id !== null && id !== lastIdRef.current) {
          // New crawl completed — refresh
          lastIdRef.current = id;
          router.refresh();
        }
      } catch {
        // ignore
      }
    }

    poll();
    timer = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
