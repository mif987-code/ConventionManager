export interface BulkImportItem {
    quantity: number;
    name: string;
    set_name: string;
    set_code?: string;
    card_number: string;
    language: string;
    condition: string;
    foil: string;
    cost: number;
    price_tix: number;
}
export interface ImportResult {
    success: boolean;
    imported: number;
    errors: string[];
    warnings: string[];
}
export interface ValidationResult {
    items: (BulkImportItem & {
        id: string;
        needsCorrection: boolean;
        errors?: string[];
        set_code?: string;
    })[];
    total: number;
    needsCorrection: number;
    ready: number;
}
export declare function parseImportFile(buffer: Buffer, filename: string): BulkImportItem[];
export declare function validateItems(items: BulkImportItem[], validateWithScryfall?: boolean): Promise<ValidationResult>;
export declare function bulkImportItems(items: BulkImportItem[], validateWithScryfall?: boolean, conventionId?: number): Promise<ImportResult>;
//# sourceMappingURL=bulkImportService.d.ts.map