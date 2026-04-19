import { PoolClient } from 'pg';
import { pool } from '../config/db';

/**
 * Builds a parameterized SET clause for UPDATE queries.
 * Returns { clause: "col1 = $1, col2 = $2", params: [...values], nextIndex: N }
 * Always appends updated_at = NOW().
 */
export function buildSetClause(
  fields: Record<string, unknown>,
  startIndex = 1
): { clause: string; params: unknown[]; nextIndex: number } {
  const parts: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      parts.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }

  parts.push('updated_at = NOW()');
  return { clause: parts.join(', '), params, nextIndex: idx };
}

/**
 * Wraps a function in a DB transaction. Rolls back on error, releases client.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
