import { NextResponse } from "next/server";
import { crawlAllActiveRegions } from "@/crawler/crawl";

export async function POST() {
  const results = await crawlAllActiveRegions();
  return NextResponse.json({ results });
}
