export type TournamentStructure = 'swiss' | 'single_elimination';
export interface EventType {
    id: number;
    name: string;
    category: string;
    format: string | null;
    tournament_structure: TournamentStructure;
    entry_cost_vouchers: number;
    max_players: number;
    prize_structure: Record<string, number>;
    prize_structure_ties: Record<string, number>;
    created_at: Date;
    updated_at: Date;
}
export interface Event {
    id: number;
    name: string;
    event_type_id: number;
    status: 'open' | 'ongoing' | 'finished' | 'cancelled';
    current_round: number;
    total_rounds: number;
    created_at: Date;
    finished_at: Date | null;
}
export declare function createEventType(name: string, category: string, format: string | null, entryCostVouchers: number, maxPlayers: number, prizeStructure: Record<string, number>, prizeStructureTies?: Record<string, number>, tournamentStructure?: TournamentStructure, conventionId?: number): Promise<EventType>;
export declare function updateEventType(id: number, fields: {
    name?: string;
    category?: string;
    format?: string | null;
    entry_cost_vouchers?: number;
    max_players?: number;
    prize_structure?: Record<string, number>;
    prize_structure_ties?: Record<string, number>;
    tournament_structure?: TournamentStructure;
}): Promise<EventType>;
export declare function getAllEventTypes(conventionId?: number): Promise<EventType[]>;
export declare function getEventTypeById(id: number): Promise<EventType | null>;
export declare function deleteEventType(id: number): Promise<void>;
export declare function duplicateEventType(id: number): Promise<EventType>;
export declare function createEvent(name: string, eventTypeId: number, conventionId?: number, preregistrationEnabled?: boolean): Promise<Event>;
export declare function getEventById(id: number): Promise<any>;
export declare function getAllEvents(status?: string, conventionId?: number): Promise<any[]>;
export declare function getEventParticipants(eventId: number): Promise<any[]>;
export declare function registerToEvent(userId: number, eventId: number, createdBy?: string): Promise<{
    success: boolean;
    message: string;
    costDeducted: any;
}>;
export declare function startEvent(eventId: number): Promise<any>;
export declare function createNextRound(eventId: number): Promise<{
    round: any;
    total_rounds: any;
    matches: any[];
}>;
export declare function reportMatchResult(matchId: number, player1Wins: number, player2Wins: number, matchDraws: number): Promise<{
    success: boolean;
}>;
export declare function getEventRounds(eventId: number): Promise<any[]>;
export declare function getRoundMatches(eventId: number, roundNumber: number): Promise<any[]>;
export declare function getAllEventMatches(eventId: number): Promise<any[]>;
export declare function setParticipantResult(eventId: number, userId: number, position: number): Promise<any>;
export declare function finishEvent(eventId: number, createdBy?: string): Promise<{
    success: boolean;
    prizes: {
        userId: number;
        record: string;
        amount: number;
    }[];
}>;
export declare function cancelEvent(eventId: number, createdBy?: string): Promise<{
    success: boolean;
    refundedCount: number;
}>;
//# sourceMappingURL=eventService.d.ts.map