import { pool } from '../config/db';

// Summary stats for the admin "Preregistered" tab: how many players have
// pre-registered, what packages they picked, and how full each event is
// getting before it even opens.
export async function getPreregistrationStats(conventionId: number) {
  const totalPreregistered = await pool.query(
    `SELECT COUNT(*)::int AS count FROM users WHERE convention_id = $1 AND is_preregistered = TRUE`,
    [conventionId]
  );

  const activated = await pool.query(
    `SELECT COUNT(*)::int AS count FROM users WHERE convention_id = $1 AND is_preregistered = TRUE AND is_active = TRUE`,
    [conventionId]
  );

  const packageBreakdown = await pool.query(
    `SELECT p.id, p.name, p.package_type, COALESCE(SUM(up.quantity), 0)::int AS total_quantity,
            COUNT(DISTINCT up.user_id)::int AS user_count
     FROM packages p
     LEFT JOIN user_packages up ON up.package_id = p.id AND up.convention_id = p.convention_id
     WHERE p.convention_id = $1
     GROUP BY p.id, p.name, p.package_type
     ORDER BY p.name`,
    [conventionId]
  );

  const eventBreakdownRes = await pool.query(
    `SELECT e.id, e.name, e.preregistration_enabled, e.status, et.category,
            e.schedule_day, e.start_time, e.end_time, e.track,
            COUNT(ep.id) FILTER (WHERE ep.preregistered = TRUE)::int AS preregistered_count
     FROM events e
     JOIN event_types et ON e.event_type_id = et.id
     LEFT JOIN event_participants ep ON ep.event_id = e.id
     WHERE e.convention_id = $1
       AND e.preregistration_enabled = TRUE
     GROUP BY e.id, e.name, e.preregistration_enabled, e.status, et.category,
              e.schedule_day, e.start_time, e.end_time, e.track
     ORDER BY e.schedule_day NULLS LAST, e.start_time NULLS LAST, e.name`,
    [conventionId]
  );

  // Events created as numbered duplicates of another event (e.g. "Chaos Draft #2" as a
  // second instance of "Chaos Draft") are the same tournament for pre-registration
  // purposes — merge their counts into the base-named event and hide the duplicate row.
  const byExactName = new Map(eventBreakdownRes.rows.map((r: any) => [r.name, r]));
  const hiddenIds = new Set<number>();
  for (const row of eventBreakdownRes.rows) {
    const normalized = row.name.replace(/\s*#\d+.*$/, '').trim();
    if (normalized !== row.name && byExactName.has(normalized)) {
      const canonical: any = byExactName.get(normalized);
      canonical.preregistered_count += row.preregistered_count;
      hiddenIds.add(row.id);
    }
  }
  const eventBreakdown = { rows: eventBreakdownRes.rows.filter((r: any) => !hiddenIds.has(r.id)) };

  const attendanceBreakdown = await pool.query(
    `SELECT attendance_date, COUNT(DISTINCT user_id)::int AS count
     FROM user_attendance
     WHERE convention_id = $1
     GROUP BY attendance_date
     ORDER BY attendance_date`,
    [conventionId]
  );

  return {
    total_preregistered: totalPreregistered.rows[0].count,
    activated: activated.rows[0].count,
    packages: packageBreakdown.rows,
    events: eventBreakdown.rows,
    attendance_by_date: attendanceBreakdown.rows,
  };
}

// Full list of pre-registered users with their selected packages, attendance
// days, and pre-registered events, for the admin table view.
export async function listPreregisteredUsers(conventionId: number) {
  const usersRes = await pool.query(
    `SELECT id, name, last_name, email, age, dob, is_active, created_at
     FROM users
     WHERE convention_id = $1 AND is_preregistered = TRUE
     ORDER BY created_at DESC`,
    [conventionId]
  );

  const userIds = usersRes.rows.map((u: any) => u.id);
  if (userIds.length === 0) {
    return [];
  }

  const packagesRes = await pool.query(
    `SELECT up.user_id, p.id AS package_id, p.name, up.quantity
     FROM user_packages up
     JOIN packages p ON p.id = up.package_id
     WHERE up.user_id = ANY($1::int[])`,
    [userIds]
  );

  const attendanceRes = await pool.query(
    `SELECT user_id, attendance_date FROM user_attendance WHERE user_id = ANY($1::int[])`,
    [userIds]
  );

  const eventsRes = await pool.query(
    `SELECT ep.user_id, e.id AS event_id, e.name AS event_name
     FROM event_participants ep
     JOIN events e ON e.id = ep.event_id
     WHERE ep.preregistered = TRUE AND ep.user_id = ANY($1::int[])`,
    [userIds]
  );

  const packagesByUser = new Map<number, any[]>();
  for (const row of packagesRes.rows) {
    if (!packagesByUser.has(row.user_id)) packagesByUser.set(row.user_id, []);
    packagesByUser.get(row.user_id)!.push({ package_id: row.package_id, name: row.name, quantity: row.quantity });
  }

  const attendanceByUser = new Map<number, string[]>();
  for (const row of attendanceRes.rows) {
    if (!attendanceByUser.has(row.user_id)) attendanceByUser.set(row.user_id, []);
    attendanceByUser.get(row.user_id)!.push(row.attendance_date);
  }

  const eventsByUser = new Map<number, any[]>();
  for (const row of eventsRes.rows) {
    if (!eventsByUser.has(row.user_id)) eventsByUser.set(row.user_id, []);
    eventsByUser.get(row.user_id)!.push({ event_id: row.event_id, name: row.event_name });
  }

  return usersRes.rows.map((u: any) => ({
    ...u,
    packages: packagesByUser.get(u.id) || [],
    attendance_dates: attendanceByUser.get(u.id) || [],
    preregistered_events: eventsByUser.get(u.id) || [],
  }));
}
