import { pool } from '../config/db';

export interface Attendance {
  id: number;
  user_id: number;
  convention_id: number;
  attendance_date: Date;
  created_at: Date;
}

// Get all attendance dates for a user in a convention
export async function getUserAttendance(userId: number, conventionId: number): Promise<Date[]> {
  const result = await pool.query(
    'SELECT attendance_date FROM user_attendance WHERE user_id = $1 AND convention_id = $2 ORDER BY attendance_date',
    [userId, conventionId]
  );
  return result.rows.map((row: any) => row.attendance_date);
}

// Set attendance dates for a user in a convention
export async function setUserAttendance(userId: number, conventionId: number, attendanceDates: Date[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Delete existing attendance for this user/convention
    await client.query(
      'DELETE FROM user_attendance WHERE user_id = $1 AND convention_id = $2',
      [userId, conventionId]
    );
    
    // Insert new attendance records
    for (const date of attendanceDates) {
      await client.query(
        'INSERT INTO user_attendance (user_id, convention_id, attendance_date) VALUES ($1, $2, $3)',
        [userId, conventionId, date]
      );
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Check if user is attending on a specific date
export async function isUserAttendingOnDate(userId: number, conventionId: number, date: Date): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM user_attendance WHERE user_id = $1 AND convention_id = $2 AND attendance_date = $3',
    [userId, conventionId, date]
  );
  return result.rows.length > 0;
}

// Get all users attending on a specific date
export async function getUsersAttendingOnDate(conventionId: number, date: Date): Promise<number[]> {
  const result = await pool.query(
    'SELECT user_id FROM user_attendance WHERE convention_id = $1 AND attendance_date = $2',
    [conventionId, date]
  );
  return result.rows.map((row: any) => row.user_id);
}

// Get attendance count per date for a convention
export async function getAttendanceStats(conventionId: number): Promise<{ date: Date; count: number }[]> {
  const result = await pool.query(
    'SELECT attendance_date, COUNT(*) as count FROM user_attendance WHERE convention_id = $1 GROUP BY attendance_date ORDER BY attendance_date',
    [conventionId]
  );
  return result.rows.map((row: any) => ({
    date: row.attendance_date,
    count: parseInt(row.count)
  }));
}
