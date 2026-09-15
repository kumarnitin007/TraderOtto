import type {
  AiPortfolioReport,
  AiWatchlistReport,
} from "@/types/positionsAi";

const string = { type: "string" };
const stringArray = { type: "array", items: string };

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    asOf: string,
    headline: string,
    bookRisk: {
      type: "object",
      additionalProperties: false,
      properties: {
        level: { type: "string", enum: ["low", "medium", "high"] },
        drivers: stringArray,
      },
      required: ["level", "drivers"],
    },
    catalysts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: string,
          scope: string,
          event: string,
          affects: { type: "array", items: { type: "integer" } },
          impact: { type: "string", enum: ["low", "medium", "high"] },
          note: string,
          sourceUrl: string,
        },
        required: [
          "date",
          "scope",
          "event",
          "affects",
          "impact",
          "note",
          "sourceUrl",
        ],
      },
    },
    positions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "integer" },
          tkr: string,
          risk: { type: "string", enum: ["low", "medium", "high"] },
          action: {
            type: "string",
            enum: ["hold", "watch", "reduce", "close", "roll"],
          },
          by: string,
          why: string,
          nonObvious: string,
          volumeSignal: string,
        },
        required: [
          "id",
          "tkr",
          "risk",
          "action",
          "by",
          "why",
          "nonObvious",
          "volumeSignal",
        ],
      },
    },
    concentration: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          factor: string,
          ids: { type: "array", items: { type: "integer" } },
          note: string,
        },
        required: ["factor", "ids", "note"],
      },
    },
    mispriced: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "integer" },
          view: { type: "string", enum: ["rich", "cheap", "fair"] },
          note: string,
        },
        required: ["id", "view", "note"],
      },
    },
    scenarios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: string,
          trigger: string,
          bookImpact: string,
          firstToBreak: string,
        },
        required: ["name", "trigger", "bookImpact", "firstToBreak"],
      },
    },
    blindSpots: stringArray,
    verify: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { claim: string, why: string },
        required: ["claim", "why"],
      },
    },
  },
  required: [
    "asOf",
    "headline",
    "bookRisk",
    "catalysts",
    "positions",
    "concentration",
    "mispriced",
    "scenarios",
    "blindSpots",
    "verify",
  ],
} as const;

const WATCHLIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    asOf: string,
    headline: string,
    marketBackdrop: string,
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "integer" },
          tkr: string,
          rank: { type: "integer" },
          setup: { type: "string", enum: ["ready", "watch", "avoid"] },
          bias: {
            type: "string",
            enum: ["bullish", "bearish", "neutral"],
          },
          entryTrigger: string,
          invalidation: string,
          strategy: string,
          why: string,
          events: string,
          volumeSignal: string,
          sourceUrl: string,
        },
        required: [
          "id",
          "tkr",
          "rank",
          "setup",
          "bias",
          "entryTrigger",
          "invalidation",
          "strategy",
          "why",
          "events",
          "volumeSignal",
          "sourceUrl",
        ],
      },
    },
    correlations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          factor: string,
          ids: { type: "array", items: { type: "integer" } },
          note: string,
        },
        required: ["factor", "ids", "note"],
      },
    },
    avoid: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "integer" }, reason: string },
        required: ["id", "reason"],
      },
    },
    verify: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { claim: string, why: string },
        required: ["claim", "why"],
      },
    },
  },
  required: [
    "asOf",
    "headline",
    "marketBackdrop",
    "candidates",
    "correlations",
    "avoid",
    "verify",
  ],
} as const;

type OpenAiResponse = {
  model?: string;
  output_text?: string;
  output?: {
    type?: string;
    content?: { type?: string; text?: string }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

function outputText(payload: OpenAiResponse) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

async function createAiReport<T>(
  prompt: string,
  name: string,
  schema: object
) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI is not configured.");
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        tools: [{ type: "web_search", search_context_size: "medium" }],
        text: {
          format: {
            type: "json_schema",
            name,
            strict: true,
            schema,
          },
        },
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as OpenAiResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `OpenAI failed (${response.status}).`);
    }
    const text = outputText(payload);
    if (!text) throw new Error("OpenAI returned no report.");
    return {
      report: JSON.parse(text) as T,
      model: payload.model ?? model,
      tokensIn: payload.usage?.input_tokens ?? null,
      tokensOut: payload.usage?.output_tokens ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function createPortfolioAiReport(prompt: string) {
  return createAiReport<AiPortfolioReport>(
    prompt,
    "portfolio_risk_report",
    REPORT_SCHEMA
  );
}

export function createWatchlistAiReport(prompt: string) {
  return createAiReport<AiWatchlistReport>(
    prompt,
    "watchlist_entry_report",
    WATCHLIST_SCHEMA
  );
}
