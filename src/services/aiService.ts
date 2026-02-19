import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_ACTIVITIES } from './aiData';
import { storage } from '../storage';
import type { UserPreferences, AIIdea } from '../types';

// Initialize Gemini API (API Key is provided via Vite env variables)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const aiService = {
    async generateIdeas(envId: string, letter: string, overridePrefs?: UserPreferences, proposerEmail?: string): Promise<AIIdea[]> {
        const settings = await storage.getSettings(envId);
        const prefs = overridePrefs || await storage.getPreferences(envId, proposerEmail);
        const aiProfile = await storage.getAIProfile(envId);
        const letterKey = letter.toUpperCase();

        if (!settings) return [];

        const likedTags = Object.keys(aiProfile?.likedTags || {});
        const dislikedTags = Object.keys(aiProfile?.dislikedTags || {});
        const lastDoneTags = aiProfile?.lastDoneTags || [];

        // 1. Try Gemini API first if key exists
        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

                const prefContext = prefs ? `
                PERSONALISIERUNG:
                - Budget: ${prefs.budgetTier}, Dauer: ${prefs.durationTier}
                - Stile: ${prefs.styles.join(', ')}
                - No-Gos: ${prefs.noGos.join(', ')}
                - Feedback: Mag ${likedTags.join(', ')}, Vermeide ${dislikedTags.join(', ')}
                - Vor kurzem gemacht: ${lastDoneTags.join(', ')}
                ` : '';

                const prompt = `Du bist ein kreativer Date-Planer. Generiere 5 Date-Ideen für den Buchstaben "${letterKey}".
                
                STRIKTE REGELN:
                - Sprache: Deutsch
                - Format: NUR JSON-Array von Objekten: 
                  [{"id": "...", "title": "...", "description": "...", "whyItFits": "...", "tags": ["Tag1", "Tag2"], "metadata": {"indoorOutdoor": "...", "durationTier": "...", "budgetTier": "...", "prepLevel": "...", "weatherFit": "..."}}]
                - Titel: Max 3 Wörter, beginnt mit "${letterKey}".
                - description: Max 6 Wörter, knapp und charmant.
                - tags: Mindestens 2 Tags (Relax, Food, Culture, Nature, Sport, Creative, Adventure, Home-only).
                - Metadaten-Werte: 
                  - indoorOutdoor: indoor, outdoor, both
                  - durationTier: 30-60, 60-120, 2-4h, half-day, full-day
                  - budgetTier: low, medium, high
                  - prepLevel: none, low, medium
                  - weatherFit: rain-ok, needs-fair
                - Vermeide: ${dislikedTags.join(', ')} und Themen aus ${lastDoneTags.join(', ')}.
                ${prefContext}`;

                console.log('[AI] Calling Gemini API with model gemini-2.5-flash...');
                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                const cleanedJson = responseText.replace(/```json|```/g, '').trim();
                const ideas = JSON.parse(cleanedJson);

                if (Array.isArray(ideas) && ideas.length > 0) {
                    console.log('[AI] ✅ Gemini returned', ideas.length, 'ideas');
                    return ideas.map(i => ({
                        ...i,
                        id: i.id || Math.random().toString(36).substr(2, 9),
                    }));
                }
            } catch (error) {
                console.warn('[AI] ⚠️ Gemini API Error – Fallback auf lokale Datenbank:', error);
            }
        } else {
            console.warn('[AI] ⚠️ Kein Gemini API Key gefunden – nutze lokale Datenbank');
        }

        // 2. Fallback to local database (aiData.ts)
        const availableActivities = AI_ACTIVITIES[letterKey] || AI_ACTIVITIES['DEFAULT'];
        const filtered = availableActivities.filter(activity => {
            if (activity.type === 'indoor' && !settings.activityFilters.indoor) return false;
            if (activity.type === 'outdoor' && !settings.activityFilters.outdoor) return false;
            if (dislikedTags.some(tag => activity.text.toLowerCase().includes(tag.toLowerCase()))) return false;
            return true;
        });

        const baseList = filtered.length > 0 ? filtered : availableActivities;
        return [...baseList]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(a => ({
                id: Math.random().toString(36).substr(2, 9),
                title: a.text,
                description: 'Ein schöner Vorschlag basierend auf deiner Liste.',
                whyItFits: 'Passt zu deinen Basiseinstellungen.',
                tags: ['General'],
                metadata: {
                    indoorOutdoor: a.type,
                    durationTier: '60-120',
                    budgetTier: 'medium',
                    prepLevel: 'low',
                    weatherFit: a.type === 'outdoor' ? 'needs-fair' : 'rain-ok'
                }
            }));
    }
};
