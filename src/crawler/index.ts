import { config } from "dotenv";
config({ path: ".env.development" });
config({ path: ".env", override: false });

import cron from "node-cron";
import { crawlAllActiveRegions } from "./crawl";
import { sendAlerts } from "./alerts";

const INTERVAL = process.env.CRAWL_INTERVAL_MINUTES || "60";

let isRunning = false;

function isWithinActiveHours(): boolean {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false });
  const h = parseInt(hour, 10);
  return h >= 9 && h < 20;
}

async function runCrawl() {
  if (!isWithinActiveHours()) {
    console.log("[Crawler] 운영 시간 외 (09~20시 KST), 건너뜀");
    return;
  }
  if (isRunning) {
    console.log("[Crawler] 이전 크롤 아직 진행 중, 건너뜀");
    return;
  }
  isRunning = true;
  try {
    const crawlStart = new Date();
    console.log(`[Crawler] Starting crawl at ${crawlStart.toISOString()}`);
    const results = await crawlAllActiveRegions();
    await sendAlerts(crawlStart);
    console.log(`[Crawler] Finished at ${new Date().toISOString()}`);
  } catch (error) {
    console.error("[Crawler] Fatal error:", error);
  } finally {
    isRunning = false;
  }
}

runCrawl();

cron.schedule(`*/${INTERVAL} * * * *`, runCrawl);
console.log(`[Crawler] Scheduled every ${INTERVAL} minutes`);
