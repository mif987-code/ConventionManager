interface Set {
    code: string;
    name: string;
    set_type: string;
    card_count: number;
    aliases?: string[];
}
export declare function normalizeSet(input: string): {
    code: string;
    name: string;
} | null;
export declare function searchSets(query: string): Set[];
export declare function getAllSets(): Set[];
export declare function getSetByCode(code: string): Set | null;
export declare function getSetByName(name: string): Set | null;
export declare function reloadSets(): void;
export {};
//# sourceMappingURL=setService.d.ts.map