type FinnhubProfile = {
  name?: string;
  logo?: string;
  weburl?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  exchange?: string;
  country?: string;
};

type FinnhubNews = {
  id?: number;
  headline?: string;
  summary?: string;
  source?: string;
  datetime?: number;
  url?: string;
};

type FinnhubEarning = {
  date?: string;
  hour?: string;
  epsEstimate?: number;
  revenueEstimate?: number;
  quarter?: number;
  year?: number;
};

type FinnhubRecommendation = {
  period?: string;
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
};

type FinnhubTarget = {
  targetHigh?: number;
  targetLow?: number;
  targetMean?: number;
  targetMedian?: number;
  lastUpdated?: string;
};

async function request<T>(
  path: string,
  params: Record<string, string>,
  token: string
) {
  const query = new URLSearchParams({ ...params, token });
  try {
    const response = await fetch(`https://finnhub.io/api/v1${path}?${query}`, {
      next: { revalidate: 900 },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as T & { error?: string };
    return data.error ? null : data;
  } catch {
    return null;
  }
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getFinnhubTickerDetails(symbol: string) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { configured: false, available: false } as const;

  const from = new Date();
  from.setDate(from.getDate() - 14);
  const newsFrom = isoDate(from);
  const today = isoDate(new Date());
  const earningsEnd = new Date();
  earningsEnd.setDate(earningsEnd.getDate() + 93);

  const [profile, metricsPayload, earningsPayload, news, recommendations, target] =
    await Promise.all([
      request<FinnhubProfile>("/stock/profile2", { symbol }, token),
      request<{ metric?: Record<string, number> }>(
        "/stock/metric",
        { symbol, metric: "all" },
        token
      ),
      request<{ earningsCalendar?: FinnhubEarning[] }>(
        "/calendar/earnings",
        { symbol, from: today, to: isoDate(earningsEnd) },
        token
      ),
      request<FinnhubNews[]>(
        "/company-news",
        { symbol, from: newsFrom, to: today },
        token
      ),
      request<FinnhubRecommendation[]>("/stock/recommendation", { symbol }, token),
      request<FinnhubTarget>("/stock/price-target", { symbol }, token),
    ]);

  const metrics = metricsPayload?.metric;
  const earning = earningsPayload?.earningsCalendar?.[0];
  const recommendation = recommendations?.[0];
  const available = Boolean(profile?.name || metrics || news?.length || earning);

  return {
    configured: true,
    available,
    company: profile?.name
      ? {
          name: profile.name,
          logo: profile.logo || null,
          website: profile.weburl || null,
          industry: profile.finnhubIndustry || null,
          exchange: profile.exchange || null,
          country: profile.country || null,
        }
      : null,
    fundamentals: metrics
      ? {
          marketCap: number(profile?.marketCapitalization),
          pe: number(metrics.peBasicExclExtraTTM ?? metrics.peTTM),
          beta: number(metrics.beta),
          high52: number(metrics["52WeekHigh"]),
          low52: number(metrics["52WeekLow"]),
          dividendYield: number(
            metrics.dividendYieldIndicatedAnnual ?? metrics.dividendYield5Y
          ),
          revenueGrowth: number(metrics.revenueGrowthTTMYoy),
          epsGrowth: number(metrics.epsGrowthTTMYoy),
        }
      : null,
    earnings: earning?.date
      ? {
          date: earning.date,
          timing:
            earning.hour === "bmo"
              ? "Before market"
              : earning.hour === "amc"
                ? "After hours"
                : "Time not announced",
          epsForecast:
            typeof earning.epsEstimate === "number"
              ? earning.epsEstimate.toString()
              : null,
          revenueForecast: number(earning.revenueEstimate),
          fiscalQuarter:
            earning.quarter && earning.year
              ? `Q${earning.quarter} ${earning.year}`
              : null,
        }
      : null,
    news: Array.isArray(news)
      ? news.slice(0, 8).flatMap((article) =>
          article.id && article.headline
            ? [
                {
                  id: `finnhub-${article.id}`,
                  headline: article.headline,
                  summary: article.summary ?? "",
                  source: article.source ?? "Finnhub",
                  provider: "finnhub" as const,
                  createdAt: article.datetime
                    ? new Date(article.datetime * 1000).toISOString()
                    : "",
                  url: article.url ?? null,
                },
              ]
            : []
        )
      : [],
    analyst: recommendation
      ? {
          period: recommendation.period ?? null,
          strongBuy: recommendation.strongBuy ?? 0,
          buy: recommendation.buy ?? 0,
          hold: recommendation.hold ?? 0,
          sell: recommendation.sell ?? 0,
          strongSell: recommendation.strongSell ?? 0,
          targetHigh: number(target?.targetHigh),
          targetLow: number(target?.targetLow),
          targetMean: number(target?.targetMean),
          targetMedian: number(target?.targetMedian),
          lastUpdated: target?.lastUpdated ?? null,
        }
      : null,
  } as const;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type CachedEarnings = {
  date: string;
  timing: string;
  epsForecast: string | null;
  fiscalQuarter: string | null;
};

export async function getFinnhubNextEarnings(symbol: string) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { configured: false, earnings: null as CachedEarnings | null };
  const today = isoDate(new Date());
  const earningsEnd = new Date();
  earningsEnd.setDate(earningsEnd.getDate() + 93);
  const payload = await request<{ earningsCalendar?: FinnhubEarning[] }>(
    "/calendar/earnings",
    { symbol, from: today, to: isoDate(earningsEnd) },
    token
  );
  const earning = payload?.earningsCalendar?.[0];
  if (!earning?.date) return { configured: true, earnings: null };
  return {
    configured: true,
    earnings: {
      date: earning.date,
      timing:
        earning.hour === "bmo"
          ? "Before market"
          : earning.hour === "amc"
            ? "After hours"
            : "Time not announced",
      epsForecast:
        typeof earning.epsEstimate === "number" ? earning.epsEstimate.toString() : null,
      fiscalQuarter:
        earning.quarter && earning.year ? `Q${earning.quarter} ${earning.year}` : null,
    } satisfies CachedEarnings,
  };
}

export async function getFinnhubIndustry(symbol: string) {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;
  const profile = await request<FinnhubProfile>("/stock/profile2", { symbol }, token);
  const industry = profile?.finnhubIndustry?.trim();
  return industry || null;
}
