import { NextRequest, NextResponse } from "next/server";
import { fetchRegions } from "@/lib/naver-api";

export async function GET(req: NextRequest) {
  const cortarNo = req.nextUrl.searchParams.get("cortarNo") || "0000000000";
  try {
    const data = await fetchRegions(cortarNo);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { cortarList: [], error: message },
      { status: 502 }
    );
  }
}
