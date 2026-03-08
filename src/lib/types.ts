export const PROPERTY_TYPES = {
  A01: "아파트",
  A02: "오피스텔",
  A03: "빌라",
  A04: "아파텔",
} as const;

export const TRADE_TYPES = {
  A1: "매매",
  B1: "전세",
  B2: "월세",
  B3: "단기",
} as const;

export const PRICE_LEVELS = {
  low: "저렴",
  mid: "시세 적정",
  high: "고가",
} as const;

export const INFRA_LEVELS = {
  poor: "인프라 부족",
  fair: "인프라 보통",
  good: "인프라 우수",
} as const;

export type PriceLevel = keyof typeof PRICE_LEVELS;
export type InfraLevel = keyof typeof INFRA_LEVELS;

export type PropertyTypeCode = keyof typeof PROPERTY_TYPES;
export type TradeTypeCode = keyof typeof TRADE_TYPES;

export interface RegionItem {
  name: string;
  code: string;
  type: "si" | "gun" | "eup";
}

export interface ComplexItem {
  complexNumber: number;
  name: string;
  type: string;
  totalHouseholdNumber: number;
  dealCount: number;
  leaseDepositCount: number;
  leaseMonthlyCount: number;
}

export interface ArticleItem {
  articleNumber: string;
  articleName: string;
  tradeType: string;
  propertyType: string | null;
  price: number;
  rentPrice: number | null;
  area: number | null;
  floor: string | null;
  direction: string | null;
  description: string | null;
}
