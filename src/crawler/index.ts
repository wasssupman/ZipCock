import { config } from "dotenv";
config({ path: ".env.development" });
config({ path: ".env", override: false });

import cron from "node-cron";
import { crawlAllActiveRegions } from "./crawl";
import { sendAlerts } from "./alerts";

const INTERVAL = process.env.CRAWL_INTERVAL_MINUTES || "60";

async function runCrawl() {
  console.log(`[Crawler] Starting crawl at ${new Date().toISOString()}`);
  const results = await crawlAllActiveRegions();
  const hasNewListings = results.some(
    (r) => "newListings" in r && r.newListings > 0
  );
  if (hasNewListings) {
    await sendAlerts();
  }
  console.log(`[Crawler] Finished at ${new Date().toISOString()}`);
}

runCrawl();

cron.schedule(`*/${INTERVAL} * * * *`, runCrawl);
console.log(`[Crawler] Scheduled every ${INTERVAL} minutes`);
