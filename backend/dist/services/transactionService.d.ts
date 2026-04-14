import { PoolClient } from 'pg';
export type TransactionType = 'voucher' | 'tix';
export type TransactionReason = 'topup' | 'event_entry' | 'prize' | 'refund' | 'admin_adjust' | 'purchase';
interface AddTransactionParams {
    userId: number;
    type: TransactionType;
    amount: number;
    reason: TransactionReason;
    eventId?: number | null;
    createdBy: string;
    client?: PoolClient;
}
export declare function addTransaction(params: AddTransactionParams): Promise<number>;
export declare function getBalance(userId: number, type: TransactionType, client?: PoolClient): Promise<number>;
export declare function getTransactionHistory(userId: number, type?: TransactionType, limit?: number, offset?: number): Promise<any[]>;
export {};
//# sourceMappingURL=transactionService.d.ts.map