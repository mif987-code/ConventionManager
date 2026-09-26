export async function syncPreregistrationToSheet(eventName: string, playerName: string, playerEmail: string): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  if (!url) return;

  const timeoutMs = parseInt(process.env.GOOGLE_SHEETS_TIMEOUT_MS || '10000', 10);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, event_name: eventName, player_name: playerName, player_email: playerEmail }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Google Sheets sync failed (${res.status}): ${(await res.text()).slice(0, 500)}`);
  }
}
