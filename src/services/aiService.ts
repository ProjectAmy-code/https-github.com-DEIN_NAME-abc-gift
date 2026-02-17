import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_ACTIVITIES } from './aiData';
import { storage } from '../storage';

// Initialize Gemini API (API Key is provided via Vite env variables)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const aiService = {
    async generateIdeas(letter: string): Promise<string[]> {
        const settings = await storage.getSettings();
        const letterKey = letter.toUpperCase();

        // 1. Try Gemini API first if key exists
        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

                const prompt = `Antworte als kreativer Date-Planer für Paare.
                Vorschlag: 5 Date-Ideen, die mit dem Buchstaben "${letterKey}" beginnen.
                
                STRIKTE REGELN:
                - Sprache: Deutsch
                - Länge: NUR EIN EINZIGES WORT pro Idee (max 2 Wörter wenn nötig).
                - Fokus: Das Wort MUSS zwingend mit "${letterKey}" beginnen.
                - Format: NUR eine JSON-Liste von Strings, z.B. ["${letterKey}...", "${letterKey}...", ...]. Kein Text davor oder danach.
                - Präferenzen: Indoor: ${settings.activityFilters.indoor ? 'JA' : 'NEIN'}, Outdoor: ${settings.activityFilters.outdoor ? 'JA' : 'NEIN'}.`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();

                // Clean up markdown code blocks if AI included them
                const cleanedJson = responseText.replace(/```json|```/g, '').trim();
                const ideas = JSON.parse(cleanedJson);

                if (Array.isArray(ideas) && ideas.length > 0) {
                    return ideas;
                }
            } catch (error) {
                console.error('Gemini API Error, falling back to local database:', error);
            }
        }

        // 2. Fallback to local database (aiData.ts)
        const availableActivities = AI_ACTIVITIES[letterKey] || AI_ACTIVITIES['DEFAULT'];
        const filtered = availableActivities.filter(activity => {
            if (activity.type === 'both') return true;
            if (activity.type === 'indoor' && settings.activityFilters.indoor) return true;
            if (activity.type === 'outdoor' && settings.activityFilters.outdoor) return true;
            return false;
        });

        const baseList = filtered.length > 0 ? filtered : availableActivities;
        return [...baseList]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(a => a.text);
    }
};
