export interface StoreItem {
    id: number;
    name: string;
    description: string | null;
    set_name: string | null;
    card_number: string | null;
    language: string | null;
    condition: string | null;
    foil: boolean;
    cost: number;
    price_tix: number;
    stock: number;
    image_url: string | null;
    active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface StoreOrder {
    id: number;
    user_id: number;
    item_id: number;
    quantity: number;
    total_tix: number;
    status: 'pending' | 'confirmed' | 'reserved' | 'cancelled' | 'fulfilled';
    order_type: 'purchase' | 'reserve';
    admin_note: string | null;
    created_at: Date;
    updated_at: Date;
}
export declare function createItem(name: string, description: string | null, priceTix: number, stock: number, imageUrl: string | null, mtgFields?: {
    set_name?: string;
    card_number?: string;
    language?: string;
    condition?: string;
    foil?: boolean;
    cost?: number;
}, conventionId?: number): Promise<StoreItem>;
export declare function updateItem(id: number, fields: Partial<StoreItem>): Promise<StoreItem>;
export declare function deleteItem(id: number): Promise<void>;
export declare function getItemById(id: number): Promise<StoreItem | null>;
export declare function getAllItems(activeOnly?: boolean, conventionId?: number): Promise<StoreItem[]>;
export declare function purchaseItem(userId: number, itemId: number, quantity?: number): Promise<{
    success: boolean;
    order: any;
    new_balance: number;
}>;
export declare function reserveItem(userId: number, itemId: number, quantity?: number): Promise<{
    success: boolean;
    order: any;
}>;
export declare function fulfillOrder(orderId: number, adminNote?: string): Promise<any>;
export declare function cancelOrder(orderId: number): Promise<{
    success: boolean;
}>;
export declare function getOrders(filters?: {
    status?: string;
    userId?: number;
    limit?: number;
}): Promise<any[]>;
export declare function getUserOrders(userId: number): Promise<any[]>;
//# sourceMappingURL=storeService.d.ts.map