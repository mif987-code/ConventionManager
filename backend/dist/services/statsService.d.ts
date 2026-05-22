export declare function getStats(conventionId: number): Promise<{
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
}>;
//# sourceMappingURL=statsService.d.ts.map