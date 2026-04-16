export interface Attendance {
    id: number;
    user_id: number;
    convention_id: number;
    attendance_date: Date;
    created_at: Date;
}
export declare function getUserAttendance(userId: number, conventionId: number): Promise<Date[]>;
export declare function setUserAttendance(userId: number, conventionId: number, attendanceDates: Date[]): Promise<void>;
export declare function isUserAttendingOnDate(userId: number, conventionId: number, date: Date): Promise<boolean>;
export declare function getUsersAttendingOnDate(conventionId: number, date: Date): Promise<number[]>;
export declare function getAttendanceStats(conventionId: number): Promise<{
    date: Date;
    count: number;
}[]>;
//# sourceMappingURL=attendanceService.d.ts.map