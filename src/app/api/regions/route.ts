import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRegions } from "@/lib/naver-api";

export async function GET() {
  const regions = await prisma.region.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(regions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, cortarNo, cortarType } = body;

  // If registering a si or gun level, auto-expand to child regions
  if (cortarType === "si" || cortarType === "gun") {
    const parentRegion = await prisma.region.upsert({
      where: { cortarNo },
      update: { isActive: true },
      create: { name, cortarNo, cortarType, isActive: true },
    });

    // Fetch child regions from Naver API
    let children;
    if (cortarType === "si") {
      children = await fetchRegions(cortarNo);
      // For si, children are gun level — need to go one more level
      const allDongs = [];
      for (const gun of children) {
        const gunRegion = await prisma.region.upsert({
          where: { cortarNo: gun.code },
          update: { isActive: true, parentId: parentRegion.id },
          create: {
            name: gun.name,
            cortarNo: gun.code,
            cortarType: "gun",
            parentId: parentRegion.id,
            isActive: true,
          },
        });
        const dongs = await fetchRegions(cortarNo, gun.code);
        for (const dong of dongs) {
          await prisma.region.upsert({
            where: { cortarNo: dong.code },
            update: { isActive: true, parentId: gunRegion.id },
            create: {
              name: dong.name,
              cortarNo: dong.code,
              cortarType: "eup",
              parentId: gunRegion.id,
              isActive: true,
            },
          });
          allDongs.push(dong);
        }
      }
      return NextResponse.json(
        { parent: parentRegion, childrenCount: children.length, dongsCount: allDongs.length },
        { status: 201 }
      );
    } else {
      // gun level — fetch eup children
      children = await fetchRegions(
        cortarNo.substring(0, 2) + "00000000",
        cortarNo
      );
      for (const dong of children) {
        await prisma.region.upsert({
          where: { cortarNo: dong.code },
          update: { isActive: true, parentId: parentRegion.id },
          create: {
            name: dong.name,
            cortarNo: dong.code,
            cortarType: "eup",
            parentId: parentRegion.id,
            isActive: true,
          },
        });
      }
      return NextResponse.json(
        { parent: parentRegion, childrenCount: children.length },
        { status: 201 }
      );
    }
  }

  // eup level — register directly
  const region = await prisma.region.upsert({
    where: { cortarNo },
    update: { isActive: true },
    create: { name, cortarNo, cortarType, isActive: true },
  });

  return NextResponse.json(region, { status: 201 });
}
