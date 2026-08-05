/**
 * Minimal transactional-email sender via the Resend REST API (no SDK needed).
 * Without RESEND_API_KEY configured, calls are logged instead of sent so local
 * dev and demo environments never hard-fail on a missing provider key.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "GV One <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send.\nTo: ${to}\nSubject: ${subject}\n${html}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    console.error("[email] send failed:", res.status, await res.text().catch(() => ""));
  }
}
