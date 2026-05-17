import { Router, Request, Response, NextFunction } from 'express';
import * as attendanceService from '../services/attendanceService';

const router = Router();

// GET /api/attendance/user/:userId/convention/:conventionId - Get user's attendance dates
router.get('/user/:userId/convention/:conventionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attendance = await attendanceService.getUserAttendance(
      parseInt(req.params.userId),
      parseInt(req.params.conventionId)
    );
    res.json({ success: true, attendance });
  } catch (err) {
    next(err);
  }
});

// PUT /api/attendance/user/:userId/convention/:conventionId - Set user's attendance dates
router.put('/user/:userId/convention/:conventionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attendance_dates } = req.body;
    
    if (!attendance_dates || !Array.isArray(attendance_dates)) {
      return res.status(400).json({ error: 'attendance_dates array is required' });
    }

    const dates = attendance_dates.map((d: unknown) => {
      if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(d)) {
        throw Object.assign(new Error(`Invalid date format: ${d}`), { status: 400 });
      }
      const date = new Date(d);
      if (isNaN(date.getTime())) throw Object.assign(new Error(`Invalid date: ${d}`), { status: 400 });
      return date;
    });
    await attendanceService.setUserAttendance(
      parseInt(req.params.userId),
      parseInt(req.params.conventionId),
      dates
    );
    
    res.json({ success: true, message: 'Attendance updated' });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/convention/:conventionId/date/:date - Get users attending on a specific date
router.get('/convention/:conventionId/date/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateStr = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: `Invalid date: ${dateStr}` });
    }
    const users = await attendanceService.getUsersAttendingOnDate(
      parseInt(req.params.conventionId),
      parsedDate
    );
    res.json({ success: true, user_ids: users });
  } catch (err) {
    next(err);
  }
});

// GET /api/attendance/convention/:conventionId/stats - Get attendance statistics
router.get('/convention/:conventionId/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await attendanceService.getAttendanceStats(parseInt(req.params.conventionId));
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

export default router;
