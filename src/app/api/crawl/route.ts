import { NextResponse } from "next/server";
import { crawlAllActiveRegions } from "@/crawler/crawl";
import { sendAlerts } from "@/crawler/alerts";

export async function POST() {
  const results = await crawlAllActiveRegions();
  const hasChanges = results.some(
    (r) => "newListings" in r && (r.newListings > 0 || r.updatedListings > 0)
  );
  if (hasChanges) {
    await sendAlerts();
  }
  return NextResponse.json({ results });
}
