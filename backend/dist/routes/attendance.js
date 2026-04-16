"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceService = __importStar(require("../services/attendanceService"));
const router = (0, express_1.Router)();
// GET /api/attendance/user/:userId/convention/:conventionId - Get user's attendance dates
router.get('/user/:userId/convention/:conventionId', async (req, res, next) => {
    try {
        const attendance = await attendanceService.getUserAttendance(parseInt(req.params.userId), parseInt(req.params.conventionId));
        res.json({ success: true, attendance });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/attendance/user/:userId/convention/:conventionId - Set user's attendance dates
router.put('/user/:userId/convention/:conventionId', async (req, res, next) => {
    try {
        const { attendance_dates } = req.body;
        if (!attendance_dates || !Array.isArray(attendance_dates)) {
            return res.status(400).json({ error: 'attendance_dates array is required' });
        }
        const dates = attendance_dates.map((d) => new Date(d));
        await attendanceService.setUserAttendance(parseInt(req.params.userId), parseInt(req.params.conventionId), dates);
        res.json({ success: true, message: 'Attendance updated' });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/attendance/convention/:conventionId/date/:date - Get users attending on a specific date
router.get('/convention/:conventionId/date/:date', async (req, res, next) => {
    try {
        const users = await attendanceService.getUsersAttendingOnDate(parseInt(req.params.conventionId), new Date(req.params.date));
        res.json({ success: true, user_ids: users });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/attendance/convention/:conventionId/stats - Get attendance statistics
router.get('/convention/:conventionId/stats', async (req, res, next) => {
    try {
        const stats = await attendanceService.getAttendanceStats(parseInt(req.params.conventionId));
        res.json({ success: true, stats });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=attendance.js.map