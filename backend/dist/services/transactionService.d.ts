import { PoolClient } from 'pg';
export type TransactionType = 'voucher' | 'tix';
export type TransactionReason = 'topup' | 'event_entry' | 'prize' | 'refund' | 'admin_adjust' | 'purchase' | 'special_voucher' | 'special_voucher_refund';
interface AddTransactionParams {
    userId: number;
    type: TransactionType;
    amount: number;
    reason: TransactionReason;
    eventId?: number | null;
    createdBy: string;
    client?: PoolClient;
    conventionId?: number;
    paymentLink?: string | null;
}
export declare function addTransaction(params: AddTransactionParams): Promise<number>;
export declare function getBalance(userId: number, type: TransactionType, client?: PoolClient, conventionId?: number): Promise<number>;
export declare function getTransactionHistory(userId: number, type?: TransactionType, limit?: number, offset?: number): Promise<any[]>;
export {};
//# sourceMappingURL=transactionService.d.ts.map