import { NextResponse } from "next/server";
import { crawlAllActiveRegions } from "@/crawler/crawl";
import { sendAlerts } from "@/crawler/alerts";

export async function POST() {
  const results = await crawlAllActiveRegions();
  await sendAlerts();
  return NextResponse.json({ results });
}
