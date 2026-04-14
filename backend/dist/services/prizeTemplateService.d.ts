export interface PrizeTemplate {
    id: number;
    name: string;
    rounds: number;
    prize_structure: Record<string, number>;
    prize_structure_ties: Record<string, number>;
    created_at: Date;
    updated_at: Date;
}
export declare function createPrizeTemplate(name: string, rounds: number, prizeStructure: Record<string, number>, prizeStructureTies: Record<string, number>): Promise<PrizeTemplate>;
export declare function updatePrizeTemplate(id: number, fields: {
    name?: string;
    rounds?: number;
    prize_structure?: Record<string, number>;
    prize_structure_ties?: Record<string, number>;
}): Promise<PrizeTemplate>;
export declare function deletePrizeTemplate(id: number): Promise<void>;
export declare function getAllPrizeTemplates(): Promise<PrizeTemplate[]>;
export declare function getPrizeTemplatesByRounds(rounds: number): Promise<PrizeTemplate[]>;
export declare function getPrizeTemplateById(id: number): Promise<PrizeTemplate | null>;
//# sourceMappingURL=prizeTemplateService.d.ts.map