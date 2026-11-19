/**
 * Minimal transactional-email sender via the Resend REST API (no SDK needed).
 * Returns true only when the provider accepted the message. A missing
 * RESEND_API_KEY, a non-2xx answer or a network error all return false, so a
 * caller never reports "sent" for mail that was not delivered. The HTML body
 * is never logged (payslips carry salary, reset mails carry a token).
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "GV One <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set, email not sent. Subject: ${subject}`);
    return false;
  }

  try {
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
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}
