export declare const PERMISSION_CATEGORIES: readonly ["super", "users", "events", "vouchers", "tix", "store", "stats", "register"];
export type PermissionCategory = typeof PERMISSION_CATEGORIES[number];
export declare function getPermissions(userId: number): Promise<PermissionCategory[]>;
export declare function setPermissions(userId: number, permissions: PermissionCategory[]): Promise<PermissionCategory[]>;
export declare function addPermission(userId: number, permission: PermissionCategory): Promise<PermissionCategory[]>;
export declare function removePermission(userId: number, permission: PermissionCategory): Promise<PermissionCategory[]>;
export declare function hasPermission(userId: number, permission: PermissionCategory): Promise<boolean>;
export declare function getAllAdmins(): Promise<any[]>;
export declare function setAdminStatus(userId: number, isAdmin: boolean, permissions?: PermissionCategory[]): Promise<any>;
//# sourceMappingURL=permissionService.d.ts.map