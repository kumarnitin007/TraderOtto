export type TickerNews = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  provider: "alpaca" | "finnhub";
  createdAt: string;
  url: string | null;
};

export type CorporateAction = {
  type: string;
  date: string | null;
  label: string;
};

export type TickerDetails = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  earnings: {
    date: string;
    timing: string;
    epsForecast: string | null;
    fiscalQuarter: string | null;
    revenueForecast?: number | null;
  } | null;
  market: {
    isOpen: boolean;
    nextOpen: string;
    nextClose: string;
  } | null;
  corporateActions: CorporateAction[];
  news: TickerNews[];
  company: {
    name: string;
    logo: string | null;
    website: string | null;
    industry: string | null;
    exchange: string | null;
    country: string | null;
  } | null;
  fundamentals: {
    marketCap: number | null;
    pe: number | null;
    beta: number | null;
    high52: number | null;
    low52: number | null;
    dividendYield: number | null;
    revenueGrowth: number | null;
    epsGrowth: number | null;
  } | null;
  analyst: {
    period: string | null;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    targetHigh: number | null;
    targetLow: number | null;
    targetMean: number | null;
    targetMedian: number | null;
    lastUpdated: string | null;
  } | null;
  providers: {
    alpaca: boolean;
    finnhub: boolean;
    finnhubConfigured: boolean;
  };
  marketSource: "alpaca" | "unavailable";
  earningsSource: "finnhub" | "nasdaq";
  chart: {
    t: string;
    close: number;
    sma20: number | null;
    sma50: number | null;
  }[];
};
