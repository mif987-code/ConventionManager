"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAttendance = getUserAttendance;
exports.setUserAttendance = setUserAttendance;
exports.isUserAttendingOnDate = isUserAttendingOnDate;
exports.getUsersAttendingOnDate = getUsersAttendingOnDate;
exports.getAttendanceStats = getAttendanceStats;
const db_1 = require("../config/db");
// Get all attendance dates for a user in a convention
async function getUserAttendance(userId, conventionId) {
    const result = await db_1.pool.query('SELECT attendance_date FROM user_attendance WHERE user_id = $1 AND convention_id = $2 ORDER BY attendance_date', [userId, conventionId]);
    return result.rows.map((row) => row.attendance_date);
}
// Set attendance dates for a user in a convention
async function setUserAttendance(userId, conventionId, attendanceDates) {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Delete existing attendance for this user/convention
        await client.query('DELETE FROM user_attendance WHERE user_id = $1 AND convention_id = $2', [userId, conventionId]);
        // Insert new attendance records
        for (const date of attendanceDates) {
            await client.query('INSERT INTO user_attendance (user_id, convention_id, attendance_date) VALUES ($1, $2, $3)', [userId, conventionId, date]);
        }
        await client.query('COMMIT');
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// Check if user is attending on a specific date
async function isUserAttendingOnDate(userId, conventionId, date) {
    const result = await db_1.pool.query('SELECT 1 FROM user_attendance WHERE user_id = $1 AND convention_id = $2 AND attendance_date = $3', [userId, conventionId, date]);
    return result.rows.length > 0;
}
// Get all users attending on a specific date
async function getUsersAttendingOnDate(conventionId, date) {
    const result = await db_1.pool.query('SELECT user_id FROM user_attendance WHERE convention_id = $1 AND attendance_date = $2', [conventionId, date]);
    return result.rows.map((row) => row.user_id);
}
// Get attendance count per date for a convention
async function getAttendanceStats(conventionId) {
    const result = await db_1.pool.query('SELECT attendance_date, COUNT(*) as count FROM user_attendance WHERE convention_id = $1 GROUP BY attendance_date ORDER BY attendance_date', [conventionId]);
    return result.rows.map((row) => ({
        date: row.attendance_date,
        count: parseInt(row.count)
    }));
}
//# sourceMappingURL=attendanceService.js.map