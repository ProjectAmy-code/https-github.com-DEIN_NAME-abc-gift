import localforage from 'localforage';
import type { LetterRound, AppSettings, UserID } from './types';
import { RoundStatus } from './types';
import { db } from './firebase';
import { collection, doc, setDoc, getDocs, getDoc, writeBatch } from 'firebase/firestore';

const ROUNDS_KEY = 'abc_gift_rounds';
const SETTINGS_KEY = 'abc_gift_settings';

const INITIAL_SETTINGS: AppSettings = {
    startingPerson: 'mauro',
    activityFilters: { indoor: true, outdoor: true },
    timePreference: 'both',
};

const generateInitialRounds = (startingPerson: UserID): LetterRound[] => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return alphabet.map((letter, index) => ({
        letter,
        proposerUserId: index % 2 === 0 ? startingPerson : (startingPerson === 'mauro' ? 'giorgia' : 'mauro'),
        status: RoundStatus.NotStarted,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));
};

export const storage = {
    async getRounds(): Promise<LetterRound[]> {
        try {
            // Try fetching from Firestore first
            const querySnapshot = await getDocs(collection(db, 'rounds'));
            if (!querySnapshot.empty) {
                const data = querySnapshot.docs.map(doc => doc.data() as LetterRound);
                const sorted = data.sort((a, b) => a.letter.localeCompare(b.letter));
                await localforage.setItem(ROUNDS_KEY, sorted);
                return sorted;
            }
        } catch (e) {
            console.error('Error fetching from Firestore:', e);
        }

        // Fallback to local storage
        const rounds = await localforage.getItem<LetterRound[]>(ROUNDS_KEY);
        if (!rounds) {
            const settings = await this.getSettings();
            const initialRounds = generateInitialRounds(settings.startingPerson);
            await this.saveRounds(initialRounds);
            return initialRounds;
        }
        return rounds;
    },

    async saveRounds(rounds: LetterRound[]): Promise<void> {
        // Save locally first for responsiveness
        await localforage.setItem(ROUNDS_KEY, rounds);

        // Then try saving to Firestore
        try {
            const batch = writeBatch(db);
            for (const round of rounds) {
                const ref = doc(db, 'rounds', round.letter);
                batch.set(ref, round);
            }
            await batch.commit();
        } catch (e) {
            console.error('Error saving to Firestore:', e);
        }
    },

    async getSettings(): Promise<AppSettings> {
        try {
            const docRef = doc(db, 'settings', 'current');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as AppSettings;
                await localforage.setItem(SETTINGS_KEY, data);
                return data;
            }
        } catch (e) {
            console.error('Error fetching settings from Firestore:', e);
        }

        const settings = await localforage.getItem<AppSettings>(SETTINGS_KEY);
        return settings || INITIAL_SETTINGS;
    },

    async saveSettings(settings: AppSettings): Promise<void> {
        await localforage.setItem(SETTINGS_KEY, settings);
        try {
            await setDoc(doc(db, 'settings', 'current'), settings);
        } catch (e) {
            console.error('Error saving settings to Firestore:', e);
        }
    },

    async resetRounds(startingPerson: UserID): Promise<LetterRound[]> {
        const rounds = generateInitialRounds(startingPerson);
        await this.saveRounds(rounds);
        return rounds;
    }
};
