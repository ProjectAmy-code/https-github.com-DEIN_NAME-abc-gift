export type UserID = string;

export interface UserProfile {
    uid: string;
    email: string;
    environmentId: string;
    displayName: string;
    age?: number;
    photoURL?: string;
    aboutMe?: string;
    city?: string;
}

export interface Environment {
    id: string;
    name?: string; // Optional for legacy support, but required for new setups
    memberEmails: string[];
    memberNames: Record<string, string>; // mapping email to display name
    memberOrder?: string[]; // The sequence of emails for rounds
    startingPersonEmail: string;
    adminEmail: string; // The user who manages the environment
    abcMode?: 'sequential' | 'random'; // How letters are assigned
    drawnOrder?: string[]; // Letters already drawn in random mode, e.g. ['M', 'F', 'T']
    eventInterval?: { value: number; unit: 'days' | 'weeks' | 'months' }; // Rhythm of the events
    isPublic?: boolean; // Whether to show this journey on the public charts/ranking page
    createdAt: string;
}

export const RoundStatus = {
    NotStarted: 'Not started',
    Draft: 'Draft',
    Planned: 'Planned',
    Done: 'Done',
} as const;

export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

export interface LetterRound {
    letter: string;
    proposerUserId: string;
    proposalText?: string;
    date?: string;
    status: RoundStatus;
    notes?: string;
    // v0.2 metadata
    durationTier?: UserPreferences['durationTier'];
    budgetTier?: UserPreferences['budgetTier'];
    tags?: string[];
    // Feedback
    rating?: number;
    feedback?: 'more' | 'never' | null;
    feedbackTags?: string[];
    doneAt?: string;
    // Evaluation and Publication
    evaluationText?: string;
    imageUrl?: string;
    imageUrls?: string[];
    publishReview?: boolean;
    // Individual ratings
    ratings?: Record<string, number>;
    createdAt: string;
    updatedAt: string;
}

export interface AIIdea {
    id: string;
    title: string;
    description: string;
    whyItFits: string;
    tags: string[];
    matchedPreferences?: string[];
    getYourGuideSearch?: string;
    getYourGuidePrice?: string;
    getYourGuideCount?: number;
    metadata: {
        indoorOutdoor: 'indoor' | 'outdoor' | 'both';
        durationTier: UserPreferences['durationTier'];
        budgetTier: UserPreferences['budgetTier'];
        prepLevel: 'none' | 'low' | 'medium';
        weatherFit: 'rain-ok' | 'needs-fair';
    };
}

export interface AIProfile {
    likedTags: Record<string, number>;
    dislikedTags: Record<string, number>;
    lastDoneTags: string[];
    updatedAt: string;
}

export interface SavedIdea extends AIIdea {
    savedAt: string;
}

export interface AppSettings {
    startingPerson: string; // email
    activityFilters: {
        indoor: boolean;
        outdoor: boolean;
    };
    timePreference: 'weekday' | 'weekend' | 'both';
}

export interface UserPreferences {
    radiusKm: number;
    planningDays: string[];
    budgetTier: string[];
    durationTier: string[];
    timeOfDay: string[];
    styles: string[];
    indoorOutdoor: string[];
    rainRulePreferIndoor: boolean;
    carAvailable: boolean;
    kidsIncluded: boolean;
    noGos: string[];
    notes?: string;
    completedAt?: string;
    aiIdeaCache?: Record<string, AIIdea[]>;
}
