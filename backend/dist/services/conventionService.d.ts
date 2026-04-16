export interface Convention {
    id: number;
    name: string;
    status: 'active' | 'ended';
    start_date?: Date;
    end_date?: Date;
    created_at: Date;
    ended_at: Date | null;
    scan_mode?: 'nfc' | 'qr';
}
export interface ConventionStats {
    player_count: number;
    player_names: string[];
    total_events: number;
    event_types_breakdown: {
        type: string;
        count: number;
    }[];
    events_player_counts: {
        event_id: number;
        event_name: string;
        player_count: number;
    }[];
    total_tix_awarded: number;
    total_tix_used: number;
    tix_by_product: {
        product_name: string;
        tix_used: number;
    }[];
    products_sold_currency: {
        product_name: string;
        total_sales: number;
    }[];
    purchases_tix_vs_currency: {
        tix_purchases: number;
        currency_purchases: number;
    }[];
    vouchers_sold: number;
    vouchers_unused: number;
}
export declare function listConventions(): Promise<{
    conventions: Convention[];
}>;
export declare function createConvention(name: string, startDate?: Date, endDate?: Date): Promise<Convention>;
export declare function getConvention(id: number): Promise<Convention | null>;
export declare function updateConvention(id: number, fields: Partial<{
    name: string;
    scan_mode: string;
    start_date: Date;
    end_date: Date;
}>): Promise<Convention | null>;
export declare function endConvention(id: number): Promise<Convention>;
export declare function getConventionStats(id: number): Promise<ConventionStats>;
export declare function exportConvention(id: number): Promise<any>;
export declare function deleteConvention(id: number): Promise<void>;
//# sourceMappingURL=conventionService.d.ts.map