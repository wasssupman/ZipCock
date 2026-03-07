import { NextRequest, NextResponse } from "next/server";
import { fetchRegions } from "@/lib/naver-api";

export async function GET(req: NextRequest) {
  const cortarNo = req.nextUrl.searchParams.get("cortarNo") || "0000000000";
  const data = await fetchRegions(cortarNo);
  return NextResponse.json(data);
}
