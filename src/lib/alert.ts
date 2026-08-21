import "server-only";

function safeStringify(detail: unknown): string {
  try {
    return detail instanceof Error ? detail.message : JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export async function notifyBillingFailure(
  context: string,
  detail: unknown
): Promise<void> {
  console.error("[alert] " + context, detail);

  const url = process.env.ALERT_WEBHOOK_URL;
  if (url) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `CCA-F billing failure: ${context} — ${safeStringify(detail)}`,
        }),
      });
    } catch (e) {
      console.error("[alert] webhook post failed", e);
    }
  }
}
