"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPrizeTemplate = createPrizeTemplate;
exports.updatePrizeTemplate = updatePrizeTemplate;
exports.deletePrizeTemplate = deletePrizeTemplate;
exports.getAllPrizeTemplates = getAllPrizeTemplates;
exports.getPrizeTemplatesByRounds = getPrizeTemplatesByRounds;
exports.getPrizeTemplateById = getPrizeTemplateById;
const db_1 = require("../config/db");
async function createPrizeTemplate(name, rounds, prizeStructure, prizeStructureTies, isPlacement = false) {
    const result = await db_1.pool.query(`INSERT INTO prize_templates (name, rounds, prize_structure, prize_structure_ties, is_placement)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`, [name, rounds, JSON.stringify(prizeStructure), JSON.stringify(prizeStructureTies), isPlacement]);
    return result.rows[0];
}
async function updatePrizeTemplate(id, fields) {
    const sets = [];
    const params = [];
    let idx = 1;
    if (fields.name !== undefined) {
        sets.push(`name = $${idx++}`);
        params.push(fields.name);
    }
    if (fields.rounds !== undefined) {
        sets.push(`rounds = $${idx++}`);
        params.push(fields.rounds);
    }
    if (fields.prize_structure !== undefined) {
        sets.push(`prize_structure = $${idx++}`);
        params.push(JSON.stringify(fields.prize_structure));
    }
    if (fields.prize_structure_ties !== undefined) {
        sets.push(`prize_structure_ties = $${idx++}`);
        params.push(JSON.stringify(fields.prize_structure_ties));
    }
    if (fields.is_placement !== undefined) {
        sets.push(`is_placement = $${idx++}`);
        params.push(fields.is_placement);
    }
    if (sets.length === 0)
        throw new Error('No fields to update');
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const result = await db_1.pool.query(`UPDATE prize_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (result.rows.length === 0)
        throw new Error('Prize template not found');
    return result.rows[0];
}
async function deletePrizeTemplate(id) {
    const result = await db_1.pool.query(`DELETE FROM prize_templates WHERE id = $1`, [id]);
    if (result.rowCount === 0)
        throw new Error('Prize template not found');
}
async function getAllPrizeTemplates() {
    const result = await db_1.pool.query(`SELECT * FROM prize_templates ORDER BY rounds, name`);
    return result.rows;
}
async function getPrizeTemplatesByRounds(rounds) {
    const result = await db_1.pool.query(`SELECT * FROM prize_templates WHERE rounds = $1 ORDER BY name`, [rounds]);
    return result.rows;
}
async function getPrizeTemplateById(id) {
    const result = await db_1.pool.query(`SELECT * FROM prize_templates WHERE id = $1`, [id]);
    return result.rows[0] || null;
}
//# sourceMappingURL=prizeTemplateService.js.map