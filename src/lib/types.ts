export const PROPERTY_TYPES = {
  APT: "아파트",
  VL: "빌라",
  DDDGG: "투룸",
  SGJT: "상가주택",
  JWJT: "전원주택",
} as const;

export const TRADE_TYPES = {
  A1: "매매",
  B1: "전세",
  B2: "월세",
} as const;

export type PropertyTypeCode = keyof typeof PROPERTY_TYPES;
export type TradeTypeCode = keyof typeof TRADE_TYPES;

export interface NaverRegion {
  cortarNo: string;
  cortarName: string;
  cortarType: string;
}

export interface NaverArticle {
  atclNo: string;
  atclNm: string;
  rletTpNm: string;
  tradTpNm: string;
  prc: number;
  rentPrc?: number;
  spc2: number;
  flrInfo: string;
  atclFetrDesc: string;
  cfmYmd: string;
  cpNm: string;
  direction: string;
}

export interface NaverArticleListResponse {
  isMoreData: boolean;
  articleList: NaverArticle[];
}

export interface NaverRegionListResponse {
  cortarList: NaverRegion[];
}
