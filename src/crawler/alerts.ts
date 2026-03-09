import { prisma } from "@/lib/prisma";
import { PROPERTY_TYPES, TRADE_TYPES, PRICE_LEVELS, INFRA_LEVELS } from "@/lib/types";
import type { PropertyTypeCode, TradeTypeCode, PriceLevel, InfraLevel } from "@/lib/types";

function formatPrice(
  price: number,
  rentPrice: number | null,
  tradeType: string
): string {
  if (tradeType === "B2" && rentPrice) {
    const deposit = price >= 10000
      ? `${price % 10000 === 0 ? (price / 10000).toFixed(0) : (price / 10000).toFixed(1)}억`
      : `${price}만`;
    return `${deposit} / 월 ${rentPrice}만`;
  }
  if (price >= 10000) {
    const billions = price / 10000;
    return `${price % 10000 === 0 ? billions.toFixed(0) : billions.toFixed(1)}억`;
  }
  return `${price}만`;
}

interface ListingInfo {
  buildingName: string | null;
  propertyType: string;
  tradeType: string;
  price: number;
  rentPrice: number | null;
  area: number | null;
  floor: string | null;
  naverUrl: string | null;
  regionId: number;
  priceLevel: string | null;
  infraLevel: string | null;
}

function formatMessage(listing: ListingInfo, type: "new" | "removed"): string {
  const propLabel =
    PROPERTY_TYPES[listing.propertyType as PropertyTypeCode] ||
    listing.propertyType;
  const tradeLabel =
    TRADE_TYPES[listing.tradeType as TradeTypeCode] || listing.tradeType;
  const price = formatPrice(listing.price, listing.rentPrice, listing.tradeType);
  const area = listing.area ? `${listing.area}m²` : "-";
  const tag = type === "new" ? "🆕 신규 매물" : "❌ 사라진 매물";

  const priceLevelTag = listing.priceLevel && listing.priceLevel in PRICE_LEVELS
    ? ` [${PRICE_LEVELS[listing.priceLevel as PriceLevel]}]`
    : "";
  const infraLevelTag = listing.infraLevel && listing.infraLevel in INFRA_LEVELS
    ? ` [${INFRA_LEVELS[listing.infraLevel as InfraLevel]}]`
    : "";

  return [
    `[${tag}] ${listing.buildingName || "이름 없음"}`,
    `유형: ${propLabel} / ${tradeLabel}`,
    `가격: ${price}${priceLevelTag}`,
    `인프라:${infraLevelTag || " -"}`,
    `면적: ${area} | 층: ${listing.floor || "-"}`,
    listing.naverUrl || "",
  ].join("\n");
}

async function sendDiscord(webhookUrl: string, message: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (res.status === 429) {
    const data = await res.json().catch(() => ({ retry_after: 2 }));
    const wait = (data.retry_after ?? 2) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    const retryRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!retryRes.ok) {
      throw new Error(`Discord webhook failed after retry: ${retryRes.status}`);
    }
  } else if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}

async function sendTelegram(botToken: string, chatId: string, message: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

function batchMessages(messages: string[], maxLen: number): string[] {
  const batches: string[] = [];
  let current = "";
  for (const msg of messages) {
    if (current && current.length + msg.length + 2 > maxLen) {
      batches.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + msg;
  }
  if (current) batches.push(current);
  return batches;
}

export async function sendAlerts(crawlStartedAt?: Date) {
  const configs = await prisma.alertConfig.findMany({
    where: { isActive: true },
  });
  if (configs.length === 0) return;

  // Check if last successful crawl was more than 3 days ago
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const lastCrawl = await prisma.crawlLog.findFirst({
    where: { status: "success" },
    orderBy: { finishedAt: "desc" },
    skip: 1, // skip the current crawl, get the previous one
  });
  const isStale = !lastCrawl?.finishedAt || lastCrawl.finishedAt < threeDaysAgo;
  const NEW_LIMIT = isStale ? 5 : undefined;

  const cutoff = crawlStartedAt ?? new Date(Date.now() - 10 * 60 * 1000);
  const [newListings, removedListings] = await Promise.all([
    prisma.listing.findMany({
      where: { firstSeenAt: { gte: cutoff }, isActive: true },
      orderBy: { firstSeenAt: "desc" },
      ...(NEW_LIMIT ? { take: NEW_LIMIT } : {}),
    }),
    prisma.listing.findMany({
      where: { isActive: false, updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: "desc" },
      ...(NEW_LIMIT ? { take: NEW_LIMIT } : {}),
    }),
  ]);

  const allAlerts: { listing: ListingInfo; type: "new" | "removed" }[] = [
    ...newListings.map((l) => ({ listing: l as ListingInfo, type: "new" as const })),
    ...removedListings.map((l) => ({ listing: l as ListingInfo, type: "removed" as const })),
  ];

  if (isStale) {
    console.log(
      `[Alert] Stale data detected (last crawl: ${lastCrawl?.finishedAt?.toISOString() ?? "never"}), limiting to ${NEW_LIMIT} alerts each`
    );
  }
  console.log(
    `[Alert] Found ${newListings.length} new, ${removedListings.length} removed listings in last 10 min`
  );
  if (allAlerts.length === 0) return;

  for (const config of configs) {
    const filterPropTypes = config.filterPropertyTypes
      ? config.filterPropertyTypes.split(",").map((s) => s.trim())
      : null;
    const filterTradeTypes = config.filterTradeTypes
      ? config.filterTradeTypes.split(",").map((s) => s.trim())
      : null;
    const filterRegionIds = config.filterRegionIds
      ? config.filterRegionIds.split(",").map((s) => Number(s.trim()))
      : null;

    const matched = allAlerts.filter(({ listing: l }) => {
      if (filterPropTypes && !filterPropTypes.includes(l.propertyType))
        return false;
      if (filterTradeTypes && !filterTradeTypes.includes(l.tradeType))
        return false;
      if (filterRegionIds && !filterRegionIds.includes(l.regionId))
        return false;
      if (config.filterMinPrice && l.price < config.filterMinPrice)
        return false;
      if (config.filterMaxPrice && l.price > config.filterMaxPrice)
        return false;
      return true;
    });

    // Batch messages to avoid rate limits (Discord 2000 char limit)
    const messages = matched.map(({ listing, type }) =>
      formatMessage(listing, type)
    );
    const batches = batchMessages(messages, 1900);

    for (const batch of batches) {
      try {
        if (config.channel === "discord" && config.webhookUrl) {
          await sendDiscord(config.webhookUrl, batch);
        } else if (
          config.channel === "telegram" &&
          config.botToken &&
          config.chatId
        ) {
          await sendTelegram(config.botToken, config.chatId, batch);
        }
      } catch (error) {
        console.error(
          `[Alert] Failed to send ${config.channel} alert:`,
          error
        );
      }
      // Small delay between batches to avoid rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
