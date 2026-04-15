export interface QRTokenPayload {
    user_id: number;
    exp: number;
    nonce: string;
}
export declare function generateQRToken(userId: number, expiresInHours?: number): string;
export declare function verifyQRToken(token: string): QRTokenPayload;
export declare function generateQRImage(token: string): Promise<string>;
export declare function storeIssuedToken(userId: number, token: string, expiresAt: Date): Promise<void>;
export declare function isTokenUsed(token: string): Promise<boolean>;
export declare function markTokenAsUsed(token: string, userId: number): Promise<void>;
export declare function cleanupExpiredTokens(): Promise<void>;
export declare function checkRateLimit(identifier: string, maxScans?: number, windowMs?: number): boolean;
export declare function calculateRiskScore(multiDevice: boolean, highFrequency: boolean, tokenReuse: boolean): number;
//# sourceMappingURL=qrTokenService.d.ts.map