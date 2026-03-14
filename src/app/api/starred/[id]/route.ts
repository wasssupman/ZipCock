import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listingId = Number(id);

  await prisma.starredListing.deleteMany({ where: { listingId } });

  return NextResponse.json({ ok: true });
}
