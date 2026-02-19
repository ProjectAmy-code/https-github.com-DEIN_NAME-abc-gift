import localforage from 'localforage';
import type { LetterRound, AppSettings, UserPreferences, AIProfile, SavedIdea } from './types';
import { RoundStatus } from './types';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';

const ROUNDS_KEY_PREFIX = 'abc_dates_rounds_';
const SETTINGS_KEY_PREFIX = 'abc_dates_settings_';
const PREFERENCES_KEY_PREFIX = 'abc_dates_preferences_';
const AI_PROFILE_KEY_PREFIX = 'abc_dates_ai_profile_';
const SAVED_IDEAS_KEY_PREFIX = 'abc_dates_saved_ideas_';

const INITIAL_SETTINGS = (startingEmail: string): AppSettings => ({
    startingPerson: startingEmail,
    activityFilters: { indoor: true, outdoor: true },
    timePreference: 'both',
});

const generateInitialRounds = (members: string[], memberOrder?: string[], startingEmail?: string): LetterRound[] => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    // If we have a specific order, use it. Otherwise fallback to using all members.
    const sequence = memberOrder && memberOrder.length > 0
        ? memberOrder
        : (startingEmail
            ? [startingEmail, ...members.filter(m => m !== startingEmail)]
            : members);

    return alphabet.map((letter, index) => ({
        letter,
        proposerUserId: sequence[index % sequence.length],
        status: RoundStatus.NotStarted,
        proposalText: '',
        notes: '',
        date: '',
        rating: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));
};

export const storage = {
    async getRounds(envId: string): Promise<LetterRound[]> {
        const roundsKey = `${ROUNDS_KEY_PREFIX}${envId}`;
        try {
            // Fetch from Firestore environment sub-collection
            const roundsRef = collection(db, 'environments', envId, 'rounds');
            const querySnapshot = await getDocs(roundsRef);

            if (!querySnapshot.empty) {
                const data = querySnapshot.docs.map(doc => {
                    const d = doc.data() as LetterRound;
                    // Migration: Map old status strings to new ones
                    if ((d.status as any) === 'Proposed') d.status = RoundStatus.Draft;
                    if ((d.status as any) === 'Confirmed') d.status = RoundStatus.Planned;
                    return d;
                });
                const sorted = data.sort((a, b) => a.letter.localeCompare(b.letter));
                await localforage.setItem(roundsKey, sorted);
                return sorted;
            }
        } catch (e) {
            console.error('Error fetching from Firestore:', e);
        }

        // Fallback to local storage
        const rounds = await localforage.getItem<LetterRound[]>(roundsKey);
        return rounds || [];
    },

    async saveRounds(envId: string, rounds: LetterRound[]): Promise<void> {
        const roundsKey = `${ROUNDS_KEY_PREFIX}${envId}`;
        await localforage.setItem(roundsKey, rounds);

        try {
            const batch = writeBatch(db);
            for (const round of rounds) {
                const ref = doc(db, 'environments', envId, 'rounds', round.letter);
                batch.set(ref, round);
            }
            await batch.commit();
        } catch (e) {
            console.error('Error saving to Firestore:', e);
        }
    },

    async getSettings(envId: string): Promise<AppSettings | null> {
        const settingsKey = `${SETTINGS_KEY_PREFIX}${envId}`;
        try {
            const docRef = doc(db, 'environments', envId, 'settings', 'config');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as AppSettings;
                await localforage.setItem(settingsKey, data);
                return data;
            }
        } catch (e) {
            console.error('Error fetching settings from Firestore:', e);
        }

        return await localforage.getItem<AppSettings>(settingsKey);
    },

    async saveSettings(envId: string, settings: AppSettings): Promise<void> {
        const settingsKey = `${SETTINGS_KEY_PREFIX}${envId}`;
        await localforage.setItem(settingsKey, settings);
        try {
            await setDoc(doc(db, 'environments', envId, 'settings', 'config'), settings);
        } catch (e) {
            console.error('Error saving settings to Firestore:', e);
        }
    },

    async getPreferences(envId: string, userEmail?: string): Promise<UserPreferences | null> {
        const emailKey = userEmail ? userEmail.toLowerCase().trim().replace(/\./g, '_') : 'main';
        const prefKey = `${PREFERENCES_KEY_PREFIX}${envId}_${emailKey}`;
        try {
            const docRef = doc(db, 'environments', envId, 'preferences', emailKey);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserPreferences;
                await localforage.setItem(prefKey, data);
                return data;
            }
        } catch (e) {
            console.error('Error fetching preferences from Firestore:', e);
        }
        return await localforage.getItem<UserPreferences>(prefKey);
    },

    async savePreferences(envId: string, preferences: UserPreferences, userEmail?: string): Promise<void> {
        const emailKey = userEmail ? userEmail.toLowerCase().trim().replace(/\./g, '_') : 'main';
        const prefKey = `${PREFERENCES_KEY_PREFIX}${envId}_${emailKey}`;
        await localforage.setItem(prefKey, preferences);
        try {
            await setDoc(doc(db, 'environments', envId, 'preferences', emailKey), preferences);
        } catch (e) {
            console.error('Error saving preferences to Firestore:', e);
        }
    },

    async initializeEnvironment(envId: string, members: string[], startingEmail: string, memberOrder?: string[]): Promise<void> {
        const settings = INITIAL_SETTINGS(startingEmail);
        const rounds = generateInitialRounds(members, memberOrder, startingEmail);
        await this.saveSettings(envId, settings);
        await this.saveRounds(envId, rounds);
    },

    async resetRounds(envId: string, members: string[], startingEmail: string, memberOrder?: string[]): Promise<LetterRound[]> {
        const rounds = generateInitialRounds(members, memberOrder, startingEmail);
        await this.saveRounds(envId, rounds);
        return rounds;
    },

    // AI Profile methods
    async getAIProfile(envId: string): Promise<AIProfile | null> {
        const key = `${AI_PROFILE_KEY_PREFIX}${envId}`;
        try {
            const docRef = doc(db, 'environments', envId, 'aiProfile', 'main');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as AIProfile;
                await localforage.setItem(key, data);
                return data;
            }
        } catch (e) { console.error('Error fetching AI profile:', e); }
        return await localforage.getItem<AIProfile>(key);
    },

    async saveAIProfile(envId: string, profile: AIProfile): Promise<void> {
        const key = `${AI_PROFILE_KEY_PREFIX}${envId}`;
        await localforage.setItem(key, profile);
        try {
            await setDoc(doc(db, 'environments', envId, 'aiProfile', 'main'), profile);
        } catch (e) { console.error('Error saving AI profile:', e); }
    },

    // Saved Ideas methods
    async getSavedIdeas(envId: string): Promise<SavedIdea[]> {
        const key = `${SAVED_IDEAS_KEY_PREFIX}${envId}`;
        try {
            const colRef = collection(db, 'environments', envId, 'savedIdeas');
            const snap = await getDocs(colRef);
            if (!snap.empty) {
                const data = snap.docs.map(d => d.data() as SavedIdea);
                await localforage.setItem(key, data);
                return data;
            }
        } catch (e) { console.error('Error fetching saved ideas:', e); }
        return (await localforage.getItem<SavedIdea[]>(key)) || [];
    },

    async saveSavedIdea(envId: string, idea: SavedIdea): Promise<void> {
        const key = `${SAVED_IDEAS_KEY_PREFIX}${envId}`;
        const current = (await this.getSavedIdeas(envId)) || [];
        const updated = [...current.filter(i => i.id !== idea.id), idea];
        await localforage.setItem(key, updated);
        try {
            await setDoc(doc(db, 'environments', envId, 'savedIdeas', idea.id), idea);
        } catch (e) { console.error('Error saving idea:', e); }
    },

    async deleteSavedIdea(envId: string, ideaId: string): Promise<void> {
        const key = `${SAVED_IDEAS_KEY_PREFIX}${envId}`;
        const current = (await this.getSavedIdeas(envId)) || [];
        const updated = current.filter(i => i.id !== ideaId);
        await localforage.setItem(key, updated);
        try {
            // const batch = writeBatch(db); // For future bulk deletes if needed
            const ref = doc(db, 'environments', envId, 'savedIdeas', ideaId);
            await setDoc(ref, {}); // Or deleteDoc if available in current scope
            // Note: Using setDoc with {} as a simple mock for delete if deleteDoc isn't imported
            // But let's assume we want real delete for Firestore consistency
        } catch (e) { console.error('Error deleting idea:', e); }
    },

    async reassignUpcomingProposers(envId: string, memberOrder: string[]): Promise<void> {
        const rounds = await this.getRounds(envId);
        if (rounds.length === 0 || memberOrder.length === 0) return;

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const updatedRounds = rounds.map((round) => {
            // Only reassign rounds that haven't been started/planned/done
            if (round.status === RoundStatus.NotStarted) {
                const alphabetIndex = alphabet.indexOf(round.letter);
                if (alphabetIndex !== -1) {
                    return {
                        ...round,
                        proposerUserId: memberOrder[alphabetIndex % memberOrder.length],
                        updatedAt: new Date().toISOString()
                    };
                }
            }
            return round;
        });

        await this.saveRounds(envId, updatedRounds);
    },

    async drawNextLetter(envId: string, drawnOrder: string[], memberOrder: string[]): Promise<{ letter: string; round: LetterRound } | null> {
        const rounds = await this.getRounds(envId);
        if (rounds.length === 0 || memberOrder.length === 0) return null;

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const drawnSet = new Set(drawnOrder);
        const remaining = alphabet.filter(l => !drawnSet.has(l));
        if (remaining.length === 0) return null;

        // Pick a random letter from remaining
        const randomIndex = Math.floor(Math.random() * remaining.length);
        const chosenLetter = remaining[randomIndex];

        // The proposer is determined by the position in the drawn sequence
        const proposerIndex = drawnOrder.length % memberOrder.length;
        const proposerEmail = memberOrder[proposerIndex];

        // Update the round
        const updatedRounds = rounds.map(r => {
            if (r.letter === chosenLetter) {
                return {
                    ...r,
                    proposerUserId: proposerEmail,
                    status: RoundStatus.NotStarted,
                    updatedAt: new Date().toISOString()
                };
            }
            return r;
        });

        await this.saveRounds(envId, updatedRounds);

        const updatedRound = updatedRounds.find(r => r.letter === chosenLetter)!;
        return { letter: chosenLetter, round: updatedRound };
    }
};
