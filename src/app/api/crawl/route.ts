import { NextResponse } from "next/server";
import { crawlAllActiveRegions } from "@/crawler/crawl";
import { sendAlerts } from "@/crawler/alerts";

export async function POST() {
  const crawlStart = new Date();
  const results = await crawlAllActiveRegions();
  await sendAlerts(crawlStart);
  return NextResponse.json({ results });
}
