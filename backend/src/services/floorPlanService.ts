import { Pool, PoolClient } from 'pg';
import pool from '../config/db';

export interface FloorPlanTable {
  id: number;
  table_number: string;
  x: number; y: number; w: number; h: number;
  area_id?: number; area_name?: string; area_color?: string;
}

export interface TableStatus extends FloorPlanTable {
  is_reserved: boolean;
  event_id?: number;
  event_name?: string;
  reserved_by?: number;
  reserved_at?: string;
}

// Save full plan JSON + sync floor_plan_tables rows
export async function saveFloorPlan(conventionId: number, data: any): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert plan blob
    await client.query(`
      INSERT INTO floor_plans (convention_id, data, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (convention_id) DO UPDATE SET data=$2, updated_at=NOW()
    `, [conventionId, JSON.stringify(data)]);

    // Sync individual table rows from plan data
    const tables: any[] = data.tables || [];
    const areas: any[] = data.areas || [];

    // Build area lookup: tableId -> area info
    const areaByTableId = new Map<number, {id:number,name:string,color:string}>();
    for (const area of areas) {
      for (const tid of (area.tableIds || [])) {
        areaByTableId.set(tid, { id: area.id, name: area.name, color: area.color });
      }
    }

    // Delete removed tables
    const tableNumbers = tables.map((_: any, i: number) => `T${i + 1}`);
    if (tableNumbers.length > 0) {
      await client.query(`
        DELETE FROM floor_plan_tables
        WHERE convention_id=$1 AND table_number != ALL($2::varchar[])
      `, [conventionId, tableNumbers]);
    } else {
      await client.query('DELETE FROM floor_plan_tables WHERE convention_id=$1', [conventionId]);
    }

    // Upsert each table
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const tn = `T${i + 1}`;
      const area = areaByTableId.get(t.id);
      await client.query(`
        INSERT INTO floor_plan_tables (convention_id, table_number, x, y, w, h, area_id, area_name, area_color)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (convention_id, table_number)
        DO UPDATE SET x=$3,y=$4,w=$5,h=$6,area_id=$7,area_name=$8,area_color=$9
      `, [conventionId, tn, t.x, t.y, t.w, t.h,
          area?.id ?? null, area?.name ?? null, area?.color ?? null]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getFloorPlan(conventionId: number): Promise<any | null> {
  const res = await pool.query(
    'SELECT data FROM floor_plans WHERE convention_id=$1', [conventionId]
  );
  return res.rows[0]?.data ?? null;
}

export async function getTableStatuses(conventionId: number): Promise<TableStatus[]> {
  const res = await pool.query(`
    SELECT
      fpt.id, fpt.table_number, fpt.x, fpt.y, fpt.w, fpt.h,
      fpt.area_id, fpt.area_name, fpt.area_color,
      CASE WHEN tr.id IS NOT NULL THEN true ELSE false END AS is_reserved,
      tr.event_id,
      e.name AS event_name,
      tr.reserved_by,
      tr.reserved_at
    FROM floor_plan_tables fpt
    LEFT JOIN table_reservations tr
      ON tr.table_id = fpt.id AND tr.released_at IS NULL
    LEFT JOIN events e ON e.id = tr.event_id
    WHERE fpt.convention_id = $1
    ORDER BY fpt.table_number
  `, [conventionId]);
  return res.rows;
}

export async function reserveTable(
  conventionId: number,
  tableId: number,
  eventId: number,
  reservedBy: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check not already reserved
    const existing = await client.query(`
      SELECT id FROM table_reservations
      WHERE table_id=$1 AND released_at IS NULL
    `, [tableId]);
    if (existing.rows.length > 0) throw new Error('Table already reserved');

    // Check event doesn't already have a table
    const evtCheck = await client.query(
      'SELECT table_id FROM events WHERE id=$1 AND convention_id=$2', [eventId, conventionId]
    );
    if (!evtCheck.rows[0]) throw new Error('Event not found');
    if (evtCheck.rows[0].table_id) throw new Error('Event already has a table');

    // Get table_number
    const tbl = await client.query(
      'SELECT table_number FROM floor_plan_tables WHERE id=$1', [tableId]
    );
    if (!tbl.rows[0]) throw new Error('Table not found');

    await client.query(`
      INSERT INTO table_reservations (table_id, event_id, convention_id, reserved_by)
      VALUES ($1,$2,$3,$4)
    `, [tableId, eventId, conventionId, reservedBy]);

    await client.query(`
      UPDATE events SET table_id=$1, table_number=$2 WHERE id=$3
    `, [tableId, tbl.rows[0].table_number, eventId]);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function releaseTable(eventId: number, conventionId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE table_reservations SET released_at=NOW()
      WHERE event_id=$1 AND released_at IS NULL
    `, [eventId]);
    await client.query(`
      UPDATE events SET table_id=NULL, table_number=NULL WHERE id=$1
    `, [eventId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
