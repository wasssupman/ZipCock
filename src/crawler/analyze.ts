import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import type { PropertyTypeCode, TradeTypeCode, PriceLevel, InfraLevel } from "@/lib/types";

const BATCH_SIZE = 10;
const MODEL = "claude-sonnet-4-20250514";

interface AnalysisResult {
  id: number;
  priceLevel: PriceLevel;
  infraLevel: InfraLevel;
  reason: string;
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function callClaude(prompt: string): Promise<string> {
  const anthropic = getClient();
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY not set");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block.type === "text") return block.text;
  return "";
}

function parseResponse(raw: string): AnalysisResult[] {
  try {
    // Extract JSON array from response text
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];

    const validPrice = new Set(["low", "mid", "high"]);
    const validInfra = new Set(["poor", "fair", "good"]);

    return arr
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.id === "number" &&
          validPrice.has(item.priceLevel as string) &&
          validInfra.has(item.infraLevel as string)
      )
      .map((item: Record<string, unknown>) => ({
        id: item.id as number,
        priceLevel: item.priceLevel as PriceLevel,
        infraLevel: item.infraLevel as InfraLevel,
        reason: String(item.reason || ""),
      }));
  } catch {
    return [];
  }
}

async function getMarketStats(regionId: number, propertyType: string, tradeType: string) {
  const listings = await prisma.listing.findMany({
    where: { regionId, propertyType, tradeType, isActive: true },
    select: { price: true },
    orderBy: { price: "asc" },
  });

  if (listings.length === 0) return null;

  const prices = listings.map((l) => l.price);
  const sum = prices.reduce((a, b) => a + b, 0);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? Math.round((prices[mid - 1] + prices[mid]) / 2)
      : prices[mid];

  return {
    count: prices.length,
    avg: Math.round(sum / prices.length),
    min: prices[0],
    max: prices[prices.length - 1],
    median,
  };
}

function buildPrompt(
  listings: {
    id: number;
    buildingName: string | null;
    propertyType: string;
    tradeType: string;
    price: number;
    rentPrice: number | null;
    area: number | null;
    floor: string | null;
    description: string | null;
    region: { name: string };
  }[],
  stats: { count: number; avg: number; min: number; max: number; median: number } | null,
  regionName: string
): string {
  const propLabel = (code: string) =>
    PROPERTY_TYPES[code as PropertyTypeCode] || code;
  const tradeLabel = (code: string) =>
    TRADE_TYPES[code as TradeTypeCode] || code;

  let statsBlock = "";
  if (stats) {
    statsBlock = `
## 기존 시세 통계 (${regionName})
- 매물 수: ${stats.count}건
- 평균가: ${stats.avg.toLocaleString()}만원
- 최저가: ${stats.min.toLocaleString()}만원
- 최고가: ${stats.max.toLocaleString()}만원
- 중위가: ${stats.median.toLocaleString()}만원
`;
  } else {
    statsBlock = `
## 기존 시세 통계
비교 가능한 기존 매물 데이터가 없습니다. 일반적인 시세 감각으로 판단하세요.
`;
  }

  const listingLines = listings
    .map(
      (l) =>
        `- [ID:${l.id}] ${l.buildingName || "이름없음"} | ${propLabel(l.propertyType)} ${tradeLabel(l.tradeType)} | ${l.price.toLocaleString()}만원${l.rentPrice ? ` / 월 ${l.rentPrice.toLocaleString()}만원` : ""} | ${l.area ? `${l.area}m²` : "-"} | ${l.floor || "-"}층${l.description ? ` | ${l.description}` : ""}`
    )
    .join("\n");

  return `다음은 ${regionName} 지역의 신규 부동산 매물 목록이다.
같은 지역 기존 매물 시세 통계도 함께 제공한다.
${statsBlock}
## 분석 대상 신규 매물
${listingLines}

각 매물에 대해 다음 JSON 배열로 응답하라:
[
  {
    "id": 매물ID,
    "priceLevel": "low" | "mid" | "high",
    "infraLevel": "poor" | "fair" | "good",
    "reason": "판단 근거 1~2문장"
  }
]

판단 기준:
- priceLevel: 시세 통계 대비 가격 위치. 중위가 대비 10% 이상 저렴하면 low, 10% 이상 비싸면 high, 그 사이 mid.
- infraLevel: 건물명과 지역으로 추론. 역세권/학군/대단지/신축 등 인프라 요소 종합 판단. poor=인프라 부족, fair=보통, good=인프라 우수.

JSON 배열만 출력하라. 다른 텍스트 없이 JSON만.`;
}

export async function analyzeNewListings(listingIds: number[]): Promise<number> {
  if (listingIds.length === 0) return 0;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("[Analyze] ANTHROPIC_API_KEY 미설정, 분석 건너뜀");
    return 0;
  }

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    include: { region: { select: { name: true } } },
  });

  if (listings.length === 0) return 0;

  let analyzed = 0;

  // Group by regionId + propertyType + tradeType for accurate stats
  const groups = new Map<string, typeof listings>();
  for (const l of listings) {
    const key = `${l.regionId}:${l.propertyType}:${l.tradeType}`;
    const arr = groups.get(key) || [];
    arr.push(l);
    groups.set(key, arr);
  }

  for (const [key, groupListings] of groups) {
    const [regionIdStr, propertyType, tradeType] = key.split(":");
    const regionId = Number(regionIdStr);
    const regionName = groupListings[0].region.name;

    const stats = await getMarketStats(regionId, propertyType, tradeType);

    // Process in batches
    for (let i = 0; i < groupListings.length; i += BATCH_SIZE) {
      const batch = groupListings.slice(i, i + BATCH_SIZE);

      try {
        const prompt = buildPrompt(batch, stats, regionName);
        console.log(`[Analyze] Claude API 호출: ${regionName} ${batch.length}건`);
        const raw = await callClaude(prompt);
        const results = parseResponse(raw);

        for (const result of results) {
          await prisma.listing.update({
            where: { id: result.id },
            data: {
              priceLevel: result.priceLevel,
              infraLevel: result.infraLevel,
              aiAnalysis: result.reason,
              analyzedAt: new Date(),
            },
          });
          analyzed++;
        }

        console.log(`[Analyze] ${results.length}/${batch.length}건 분석 완료`);
      } catch (error) {
        console.error(
          `[Analyze] Claude API 오류 (${regionName}):`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  return analyzed;
}
