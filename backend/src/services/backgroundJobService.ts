import { PoolClient } from 'pg';
import { pool } from '../config/db';
import { syncPreregistrationToSheet } from './googleSheetsService';
import { sendActivationEmail, sendQRCodeEmail } from './emailService';

export async function enqueueGoogleSheetsSync(client: Pick<PoolClient, 'query'>, eventName: string, playerName: string, playerEmail: string): Promise<void> {
  await client.query(
    `INSERT INTO background_jobs (job_type, payload) VALUES ('google_sheets_preregistration', $1::jsonb)`,
    [JSON.stringify({ eventName, playerName, playerEmail })]
  );
}

export async function enqueueEmail(client: Pick<PoolClient, 'query'>, jobType: 'qr_email' | 'activation_email', payload: Record<string, string>): Promise<void> {
  await client.query(
    `INSERT INTO background_jobs (job_type, payload) VALUES ($1, $2::jsonb)`,
    [jobType, JSON.stringify(payload)]
  );
}

async function claimJob(): Promise<any | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM background_jobs
       WHERE ((status IN ('pending', 'failed') AND next_attempt_at <= NOW())
          OR (status = 'processing' AND created_at <= NOW() - INTERVAL '5 minutes'))
         AND attempts < 5
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }
    const job = result.rows[0];
    await client.query(`UPDATE background_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = $1`, [job.id]);
    await client.query('COMMIT');
    return { ...job, attempts: job.attempts + 1 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function processJobs(): Promise<void> {
  try {
    for (let index = 0; index < 10; index++) {
      const job = await claimJob();
      if (!job) break;
      try {
        if (job.job_type === 'google_sheets_preregistration') {
          await syncPreregistrationToSheet(job.payload.eventName, job.payload.playerName, job.payload.playerEmail);
        } else if (job.job_type === 'qr_email') {
          const sent = await sendQRCodeEmail(job.payload.to, job.payload.userName, job.payload.qrCodeDataUrl);
          if (!sent) throw new Error('QR email delivery failed');
        } else if (job.job_type === 'activation_email') {
          const sent = await sendActivationEmail(job.payload.to, job.payload.userName);
          if (!sent) throw new Error('Activation email delivery failed');
        } else {
          throw new Error(`Unsupported background job type: ${job.job_type}`);
        }
        await pool.query(`UPDATE background_jobs SET status = 'completed', completed_at = NOW(), last_error = NULL WHERE id = $1`, [job.id]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await pool.query(
          `UPDATE background_jobs
           SET status = 'failed', last_error = $2, next_attempt_at = NOW() + (INTERVAL '1 minute' * POWER(2, attempts))
           WHERE id = $1`,
          [job.id, message.slice(0, 2000)]
        );
      }
    }
  } catch (err) {
    console.error('[BackgroundJobs] Processing failed:', err);
  }
}

export function startBackgroundJobs(): void {
  const timer = setInterval(() => void processJobs(), 15000);
  timer.unref();
  void processJobs();
}
