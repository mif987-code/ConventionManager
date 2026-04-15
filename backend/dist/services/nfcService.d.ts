export declare function handleNfcScan(nfcUid: string): Promise<{
    found: boolean;
    message: string;
    user?: undefined;
} | {
    found: boolean;
    user: {
        voucher_balance: number;
        tix_balance: number;
        id: number;
        name: string;
        last_name: string | null;
        nfc_uid: string | null;
        qr_code: string | null;
        email: string | null;
        age: number | null;
        dob: string | null;
        is_admin: boolean;
        admin_permissions: string[];
        is_preregistered: boolean;
        days_playing: number;
        created_at: Date;
        updated_at: Date;
    };
    message?: undefined;
}>;
export declare function handleQrScan(qrCode: string): Promise<{
    found: boolean;
    message: string;
    user?: undefined;
} | {
    found: boolean;
    user: {
        voucher_balance: number;
        tix_balance: number;
        id: number;
        name: string;
        last_name: string | null;
        nfc_uid: string | null;
        qr_code: string | null;
        email: string | null;
        age: number | null;
        dob: string | null;
        is_admin: boolean;
        admin_permissions: string[];
        is_preregistered: boolean;
        days_playing: number;
        created_at: Date;
        updated_at: Date;
    };
    message?: undefined;
}>;
export declare function handleQrTokenScan(token: string, deviceIdentifier?: string): Promise<{
    found: boolean;
    user: {
        voucher_balance: number;
        tix_balance: number;
        id: number;
        name: string;
        last_name: string | null;
        nfc_uid: string | null;
        qr_code: string | null;
        email: string | null;
        age: number | null;
        dob: string | null;
        is_admin: boolean;
        admin_permissions: string[];
        is_preregistered: boolean;
        days_playing: number;
        created_at: Date;
        updated_at: Date;
    };
    message?: undefined;
} | {
    found: boolean;
    message: any;
    user?: undefined;
}>;
export declare function getUserByQrTokenWithBalances(token: string, deviceIdentifier?: string): Promise<{
    voucher_balance: number;
    tix_balance: number;
    id: number;
    name: string;
    last_name: string | null;
    nfc_uid: string | null;
    qr_code: string | null;
    email: string | null;
    age: number | null;
    dob: string | null;
    is_admin: boolean;
    admin_permissions: string[];
    is_preregistered: boolean;
    days_playing: number;
    created_at: Date;
    updated_at: Date;
} | null | undefined>;
//# sourceMappingURL=nfcService.d.ts.map