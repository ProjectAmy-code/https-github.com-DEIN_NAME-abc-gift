export type UserID = 'mauro' | 'giorgia';

export interface User {
    id: UserID;
    name: string;
    birthDate: string;
}

export const RoundStatus = {
    NotStarted: 'Not started',
    Proposed: 'Proposed',
    Confirmed: 'Confirmed',
    Done: 'Done',
} as const;

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

export interface LetterRound {
    letter: string;
    proposerUserId: UserID;
    proposalText?: string;
    date?: string;
    status: RoundStatus;
    notes?: string;
    rating?: number;
    createdAt: string;
    updatedAt: string;
}

export interface AppSettings {
    startingPerson: UserID;
    activityFilters: {
        indoor: boolean;
        outdoor: boolean;
    };
    timePreference: 'weekday' | 'weekend' | 'both';
}
