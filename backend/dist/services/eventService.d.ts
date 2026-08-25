export type TournamentStructure = 'swiss' | 'single_elimination';
export type TeamMode = 'single' | '2hg';
/** A prize tier's value: either a plain Tix number (legacy), or an object carrying
 *  a Tix amount and/or a Special Voucher to auto-award to whoever hits that tier. */
export type PrizeEntry = number | {
    tix?: number;
    special_voucher_id?: number | null;
};
export interface EventType {
    id: number;
    name: string;
    category: string;
    format: string | null;
    tournament_structure: TournamentStructure;
    entry_cost_vouchers: number;
    entry_cost_colones: number;
    max_players: number;
    tix_per_player: number | null;
    prize_structure: Record<string, PrizeEntry>;
    prize_structure_ties: Record<string, PrizeEntry>;
    team_mode: TeamMode;
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
    schedule_day: string | null;
    start_time: string | null;
    end_time: string | null;
    track: string | null;
    schedule_color: string | null;
    sort_order: number;
}
export interface EventScheduleFields {
    schedule_day?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    track?: string | null;
    schedule_color?: string | null;
    sort_order?: number;
}
export declare function createEventType(name: string, category: string, format: string | null, entryCostVouchers: number, maxPlayers: number, prizeStructure: Record<string, PrizeEntry>, prizeStructureTies?: Record<string, PrizeEntry>, tournamentStructure?: TournamentStructure, conventionId?: number, tixPerPlayer?: number | null, teamMode?: TeamMode): Promise<EventType>;
export declare function updateEventType(id: number, fields: {
    name?: string;
    category?: string;
    format?: string | null;
    entry_cost_vouchers?: number;
    max_players?: number;
    tix_per_player?: number | null;
    prize_structure?: Record<string, PrizeEntry>;
    prize_structure_ties?: Record<string, PrizeEntry>;
    tournament_structure?: TournamentStructure;
    team_mode?: TeamMode;
}): Promise<EventType>;
export declare function getAllEventTypes(conventionId?: number): Promise<EventType[]>;
export declare function getEventTypeById(id: number): Promise<EventType | null>;
export declare function deleteEventType(id: number): Promise<void>;
export declare function duplicateEventType(id: number): Promise<EventType>;
export declare function createEvent(name: string, eventTypeId: number, conventionId?: number, preregistrationEnabled?: boolean, schedule?: EventScheduleFields): Promise<Event>;
export declare function updateEventSchedule(id: number, fields: EventScheduleFields): Promise<Event>;
export declare function updateEventDetails(id: number, fields: {
    name?: string;
    preregistration_enabled?: boolean;
    event_type_id?: number;
}): Promise<Event>;
export declare function getEventById(id: number): Promise<any>;
export declare function getAllEvents(status?: string, conventionId?: number): Promise<any[]>;
export declare function getEventParticipants(eventId: number): Promise<any[]>;
export declare function getEventTeams(eventId: number): Promise<any[]>;
export declare function createEventTeam(eventId: number, user1Id: number, user2Id: number): Promise<any>;
export declare function deleteEventTeam(eventId: number, teamId: number): Promise<{
    success: boolean;
}>;
export declare function registerToEvent(userId: number, eventId: number, createdBy?: string): Promise<{
    success: boolean;
    message: string;
    costDeducted: number;
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
export declare function finishEvent(eventId: number, createdBy?: string, tieScenario?: string): Promise<{
    success: boolean;
    prizes: {
        userId: number;
        record: string;
        amount: number;
        specialVoucherId?: number | null;
    }[];
}>;
export declare function cancelEvent(eventId: number, createdBy?: string): Promise<{
    success: boolean;
    refundedCount: number;
}>;
//# sourceMappingURL=eventService.d.ts.map