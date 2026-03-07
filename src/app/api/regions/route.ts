import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const regions = await prisma.region.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(regions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, cortarNo, cortarType, parentId } = body;

  const region = await prisma.region.upsert({
    where: { cortarNo },
    update: { isActive: true },
    create: { name, cortarNo, cortarType, parentId: parentId || null, isActive: true },
  });

  return NextResponse.json(region, { status: 201 });
}
