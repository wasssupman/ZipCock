import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const configs = await prisma.alertConfig.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await prisma.alertConfig.create({ data: body });
  return NextResponse.json(config, { status: 201 });
}
