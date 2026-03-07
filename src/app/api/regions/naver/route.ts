import { NextRequest, NextResponse } from "next/server";
import { fetchRegions } from "@/lib/naver-api";

export async function GET(req: NextRequest) {
  const si = req.nextUrl.searchParams.get("si") || undefined;
  const gun = req.nextUrl.searchParams.get("gun") || undefined;
  try {
    const regions = await fetchRegions(si, gun);
    return NextResponse.json({ regions });
  } catch (error) {
    return NextResponse.json(
      {
        regions: [],
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
