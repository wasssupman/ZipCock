import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const config = await prisma.alertConfig.update({
    where: { id: Number(id) },
    data: body,
  });
  return NextResponse.json(config);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.alertConfig.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
