export interface AdminSetting {
    key: string;
    value: string;
    updated_at: Date;
    updated_by: number | null;
}
export declare function getSetting(key: string): Promise<string | null>;
export declare function setSetting(key: string, value: string, updatedBy?: number | null): Promise<void>;
export declare function getQRSecretKey(): Promise<string>;
export declare function setQRSecretKey(value: string, updatedBy: number): Promise<void>;
export declare function getAllSettings(): Promise<AdminSetting[]>;
//# sourceMappingURL=adminSettingsService.d.ts.map