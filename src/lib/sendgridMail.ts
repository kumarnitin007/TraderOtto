function sendgridKey() {
  return process.env.SENDGRID_API_KEY?.trim() || "";
}

export function notificationFromAddress() {
  return process.env.NOTIFICATION_FROM_EMAIL?.trim() || "";
}

function parseFrom(value: string) {
  const match = value.match(/^(.*?)\s*<([^>]+)>$/);
  if (match?.[2]) {
    return { name: match[1].trim() || "Trader Otto", email: match[2].trim() };
  }
  return { name: "Trader Otto", email: value.trim() };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendAlertEmail(input: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const apiKey = sendgridKey();
  const to = input.to.trim().toLowerCase();
  const from = parseFrom(input.from);
  if (!apiKey || !from.email || !to) {
    return { ok: false as const, error: "Email delivery is not configured on the server." };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        {
          type: "text/html",
          value: `<p>${escapeHtml(input.text).replace(/\n/g, "<br/>")}</p>`,
        },
      ],
    }),
  });

  if (response.ok) return { ok: true as const };

  const payload = (await response.json().catch(() => null)) as {
    errors?: { message?: string }[];
  } | null;
  return {
    ok: false as const,
    error:
      payload?.errors?.[0]?.message ||
      "SendGrid rejected the message. Verify the From address as a Single Sender.",
  };
}
