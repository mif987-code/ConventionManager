// Optional integration: syncs pre-registrations (event name + player name) to a
// Google Sheet in Drive via an Apps Script Web App acting as a webhook bridge.
// See docs/google-sheets-sync.md for the Apps Script code and setup steps.
//
// Required env vars (leave unset to disable this integration entirely):
//   GOOGLE_SHEETS_WEBHOOK_URL    – the deployed Apps Script Web App URL
//   GOOGLE_SHEETS_WEBHOOK_SECRET – shared secret checked by the Apps Script doPost()

export async function syncPreregistrationToSheet(eventName: string, playerName: string, playerEmail: string): Promise<void> {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!url) return; // Integration not configured — silently skip.

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, event_name: eventName, player_name: playerName, player_email: playerEmail }),
    });
    if (!res.ok) {
      console.error(`[GoogleSheets] Sync failed (${res.status}): ${await res.text()}`);
    }
  } catch (err: any) {
    // Never let a Google Sheets outage break a real pre-registration.
    console.error('[GoogleSheets] Sync request failed:', err.message);
  }
}
