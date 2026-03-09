import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const log = await prisma.crawlLog.findFirst({
    where: { status: "success" },
    orderBy: { finishedAt: "desc" },
    select: { id: true, finishedAt: true },
  });
  return NextResponse.json({
    id: log?.id ?? null,
    finishedAt: log?.finishedAt?.toISOString() ?? null,
  });
}
