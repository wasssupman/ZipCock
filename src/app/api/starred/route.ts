import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const regionId = params.get("regionId");

  const where: Record<string, unknown> = {};
  if (regionId) {
    where.listing = { regionId: Number(regionId) };
  }

  const starred = await prisma.starredListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      listing: {
        include: { region: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(starred);
}

export async function POST(req: NextRequest) {
  const { listingId } = await req.json();

  const existing = await prisma.starredListing.findUnique({
    where: { listingId },
  });

  if (existing) {
    await prisma.starredListing.delete({ where: { id: existing.id } });
    return NextResponse.json({ starred: false });
  }

  await prisma.starredListing.create({ data: { listingId } });
  return NextResponse.json({ starred: true });
}
