import { prisma } from "@/lib/prisma";
import { PROPERTY_TYPES, TRADE_TYPES } from "@/lib/types";
import type { PropertyTypeCode, TradeTypeCode } from "@/lib/types";

function formatPrice(
  price: number,
  rentPrice: number | null,
  tradeType: string
): string {
  if (tradeType === "B2" && rentPrice) {
    return `${Math.floor(price / 10000)}억 / 월 ${rentPrice}만`;
  }
  if (price >= 10000) {
    const billions = price / 10000;
    return `${price % 10000 === 0 ? billions.toFixed(0) : billions.toFixed(1)}억`;
  }
  return `${price}만`;
}

function formatMessage(listing: {
  buildingName: string | null;
  propertyType: string;
  tradeType: string;
  price: number;
  rentPrice: number | null;
  area: number | null;
  floor: string | null;
  naverUrl: string | null;
}): string {
  const propLabel =
    PROPERTY_TYPES[listing.propertyType as PropertyTypeCode] ||
    listing.propertyType;
  const tradeLabel =
    TRADE_TYPES[listing.tradeType as TradeTypeCode] || listing.tradeType;
  const price = formatPrice(listing.price, listing.rentPrice, listing.tradeType);
  const area = listing.area ? `${listing.area}m²` : "-";

  return [
    `[신규 매물] ${listing.buildingName || "이름 없음"}`,
    `유형: ${propLabel} / ${tradeLabel}`,
    `가격: ${price}`,
    `면적: ${area} | 층: ${listing.floor || "-"}`,
    listing.naverUrl || "",
  ].join("\n");
}

async function sendDiscord(webhookUrl: string, message: string) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
}

async function sendTelegram(botToken: string, chatId: string, message: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

export async function sendAlerts() {
  const configs = await prisma.alertConfig.findMany({
    where: { isActive: true },
  });
  if (configs.length === 0) return;

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const newListings = await prisma.listing.findMany({
    where: { firstSeenAt: { gte: tenMinAgo } },
    orderBy: { firstSeenAt: "desc" },
  });

  if (newListings.length === 0) return;

  for (const config of configs) {
    const filterPropTypes = config.filterPropertyTypes
      ? JSON.parse(config.filterPropertyTypes)
      : null;
    const filterTradeTypes = config.filterTradeTypes
      ? JSON.parse(config.filterTradeTypes)
      : null;
    const filterRegionIds = config.filterRegionIds
      ? JSON.parse(config.filterRegionIds)
      : null;

    const matched = newListings.filter((l) => {
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

    for (const listing of matched) {
      const message = formatMessage(listing);
      try {
        if (config.channel === "discord" && config.webhookUrl) {
          await sendDiscord(config.webhookUrl, message);
        } else if (
          config.channel === "telegram" &&
          config.botToken &&
          config.chatId
        ) {
          await sendTelegram(config.botToken, config.chatId, message);
        }
      } catch (error) {
        console.error(
          `[Alert] Failed to send ${config.channel} alert:`,
          error
        );
      }
    }
  }
}
