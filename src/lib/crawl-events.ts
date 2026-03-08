import { EventEmitter } from "events";

export type CrawlEvent =
  | { type: "crawl:start"; totalRegions: number }
  | { type: "crawl:region"; regionName: string; current: number; total: number }
  | {
      type: "crawl:complex";
      complexName: string;
      current: number;
      total: number;
      regionName: string;
    }
  | {
      type: "crawl:region_done";
      regionName: string;
      newListings: number;
      updatedListings: number;
      deactivated: number;
    }
  | { type: "crawl:analyze"; regionName: string; count: number }
  | { type: "crawl:analyze_done"; regionName: string; analyzed: number }
  | { type: "crawl:complete"; results: unknown[] }
  | { type: "crawl:error"; message: string };

class CrawlEventEmitter extends EventEmitter {
  emitCrawl(event: CrawlEvent) {
    this.emit("crawl", event);
  }

  onCrawl(listener: (event: CrawlEvent) => void) {
    this.on("crawl", listener);
    return () => {
      this.off("crawl", listener);
    };
  }
}

// Singleton — survives hot-reload in dev via globalThis
const globalForCrawl = globalThis as unknown as {
  __crawlEmitter?: CrawlEventEmitter;
};

export const crawlEmitter =
  globalForCrawl.__crawlEmitter ??
  (globalForCrawl.__crawlEmitter = new CrawlEventEmitter());
