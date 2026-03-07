import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const regionId = params.get("regionId");
  const propertyType = params.get("propertyType");
  const tradeType = params.get("tradeType");
  const sort = params.get("sort") || "firstSeenAt";
  const order = params.get("order") || "desc";
  const page = Number(params.get("page") || "1");
  const limit = Number(params.get("limit") || "20");

  const where: Record<string, unknown> = { isActive: true };
  if (regionId) where.regionId = Number(regionId);
  if (propertyType) where.propertyType = propertyType;
  if (tradeType) where.tradeType = tradeType;

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
      include: { region: { select: { name: true } } },
    }),
    prisma.listing.count({ where }),
  ]);

  return NextResponse.json({ listings, total, page, limit });
}
