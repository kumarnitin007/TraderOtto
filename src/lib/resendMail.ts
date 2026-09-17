import { Resend } from "resend";

export function resendFromAddress() {
  return (
    process.env.NOTIFICATION_FROM_EMAIL?.trim() ||
    "Trader Otto <onboarding@resend.dev>"
  );
}

export function resendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function sendResendEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const resend = resendClient();
  if (!resend) {
    return { ok: false as const, error: "Email delivery is not configured on the server." };
  }
  const { error } = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: `<p>${escapeHtml(input.text).replace(/\n/g, "<br/>")}</p>`,
  });
  if (error) {
    return { ok: false as const, error: error.message || "Email provider rejected the message." };
  }
  return { ok: true as const };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
