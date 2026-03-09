export const PROPERTY_TYPES = {
  A01: "아파트",
  A02: "오피스텔",
  A03: "빌라",
  A04: "아파텔",
  DDDGG: "단독/다가구",
  SG: "상가주택",
} as const;

export const NON_COMPLEX_PROPERTY_TYPES = ["JWJT", "DDDGG", "SGJT", "HOJT"] as const;

/** m.land rletTpCd → PROPERTY_TYPES key mapping */
export const MLAND_PROPERTY_TYPE_MAP: Record<string, string> = {
  C03: "DDDGG",  // 단독/다가구
  C04: "DDDGG",  // 단독/다가구 (별칭)
  D05: "SG",     // 상가주택
  SGJT: "SG",    // 상가주택
  HOJT: "DDDGG", // 전원주택 → 단독/다가구
  DDDGG: "DDDGG",
};

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
  /** 네이버 매물 등록(확인)일 — YYYYMMDD 또는 YYYY.MM.DD 등 */
  articleConfirmDate: string | null;
}
