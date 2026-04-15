export declare function getStats(): Promise<{
    players: {
        total: any;
        names: any[];
    };
    events: {
        total: any;
        type_breakdown: any[];
        players_per_event: any[];
        finished: any;
        ongoing: any;
        open: any;
        total_registrations: any;
    };
    tix: {
        awarded: any;
        used: any;
        usage_by_product: any[];
    };
    store: {
        real_currency_sales: any[];
        tix_purchases: any;
        currency_purchases: any;
        active_reservations: any;
    };
    vouchers: {
        sold: any;
        used: any;
        unused: number;
    };
    total_users: any;
    total_events: any;
    active_events: any;
    total_vouchers_in: any;
    total_vouchers_out: any;
    total_tix_in: any;
    total_tix_out: any;
    store_items: number;
    store_orders: any;
}>;
//# sourceMappingURL=statsService.d.ts.map