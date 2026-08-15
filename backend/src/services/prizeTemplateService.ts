import { pool } from '../config/db';

export interface PrizeTemplate {
  id: number;
  name: string;
  rounds: number;
  is_placement: boolean;
  prize_structure: Record<string, number>;
  prize_structure_ties: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

export async function createPrizeTemplate(
  name: string,
  rounds: number,
  prizeStructure: Record<string, number>,
  prizeStructureTies: Record<string, number>,
  isPlacement: boolean = false
): Promise<PrizeTemplate> {
  const result = await pool.query(
    `INSERT INTO prize_templates (name, rounds, prize_structure, prize_structure_ties, is_placement)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, rounds, JSON.stringify(prizeStructure), JSON.stringify(prizeStructureTies), isPlacement]
  );
  return result.rows[0];
}

export async function updatePrizeTemplate(
  id: number,
  fields: { name?: string; rounds?: number; prize_structure?: Record<string, number>; prize_structure_ties?: Record<string, number>; is_placement?: boolean }
): Promise<PrizeTemplate> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (fields.name !== undefined) { sets.push(`name = $${idx++}`); params.push(fields.name); }
  if (fields.rounds !== undefined) { sets.push(`rounds = $${idx++}`); params.push(fields.rounds); }
  if (fields.prize_structure !== undefined) { sets.push(`prize_structure = $${idx++}`); params.push(JSON.stringify(fields.prize_structure)); }
  if (fields.prize_structure_ties !== undefined) { sets.push(`prize_structure_ties = $${idx++}`); params.push(JSON.stringify(fields.prize_structure_ties)); }
  if (fields.is_placement !== undefined) { sets.push(`is_placement = $${idx++}`); params.push(fields.is_placement); }

  if (sets.length === 0) throw new Error('No fields to update');

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const result = await pool.query(
    `UPDATE prize_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new Error('Prize template not found');
  return result.rows[0];
}

export async function deletePrizeTemplate(id: number): Promise<void> {
  const result = await pool.query(`DELETE FROM prize_templates WHERE id = $1`, [id]);
  if (result.rowCount === 0) throw new Error('Prize template not found');
}

export async function getAllPrizeTemplates(): Promise<PrizeTemplate[]> {
  const result = await pool.query(`SELECT * FROM prize_templates ORDER BY rounds, name`);
  return result.rows;
}

export async function getPrizeTemplatesByRounds(rounds: number): Promise<PrizeTemplate[]> {
  const result = await pool.query(
    `SELECT * FROM prize_templates WHERE rounds = $1 ORDER BY name`,
    [rounds]
  );
  return result.rows;
}

export async function getPrizeTemplateById(id: number): Promise<PrizeTemplate | null> {
  const result = await pool.query(`SELECT * FROM prize_templates WHERE id = $1`, [id]);
  return result.rows[0] || null;
}
