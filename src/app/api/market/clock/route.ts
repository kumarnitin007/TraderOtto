import { alpacaCredentials, alpacaHeaders } from "@/lib/alpacaServer";
import { resolveSchedule, type AlpacaClockPayload } from "@/lib/marketSession";

export async function GET() {
  const now = new Date();
  const creds = alpacaCredentials();
  let alpaca: AlpacaClockPayload | null = null;

  if (creds.configured) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${creds.tradingUrl}/v2/clock`, {
        headers: alpacaHeaders(creds.key, creds.secret),
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.ok) {
        alpaca = (await response.json()) as AlpacaClockPayload;
      }
    } catch {
      alpaca = null;
    } finally {
      clearTimeout(timer);
    }
  }

  return Response.json(resolveSchedule(now, alpaca));
}
