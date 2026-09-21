/**
 * Send an email with user's QR badge.
 */
export declare function sendQRCodeEmail(to: string, userName: string, qrCodeDataUrl: string): Promise<boolean>;
/**
 * Send an email confirming account activation.
 */
export declare function sendPasswordResetEmail(to: string, userName: string, resetUrl: string, throwOnError?: boolean): Promise<boolean>;
export declare function sendActivationEmail(to: string, userName: string): Promise<boolean>;
//# sourceMappingURL=emailService.d.ts.map