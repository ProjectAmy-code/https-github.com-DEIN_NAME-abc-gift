import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_ACTIVITIES } from './aiData';
import { storage } from '../storage';
import type { UserPreferences, AIIdea } from '../types';

// Initialize Gemini API (API Key is provided via Vite env variables)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export const aiService = {
    async *generateIdeaStream(envId: string, letter: string, overridePrefs?: UserPreferences, proposerEmail?: string, city?: string, userPrompt?: string): AsyncGenerator<AIIdea, void, unknown> {
        const settings = await storage.getSettings(envId);
        const prefs = overridePrefs || await storage.getPreferences(envId, proposerEmail);
        const aiProfile = await storage.getAIProfile(envId);
        const letterKey = letter.toUpperCase();

        if (!settings) return;

        const likedTags = Object.keys(aiProfile?.likedTags || {});
        const dislikedTags = Object.keys(aiProfile?.dislikedTags || {});
        const lastDoneTags = aiProfile?.lastDoneTags || [];

        // 1. Try Gemini API first if key exists
        if (genAI) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

                const prefContext = prefs ? `
                PERSONALISIERUNG:
                - Budget: ${(prefs.budgetTier || []).join(', ')}, Dauer: ${(prefs.durationTier || []).join(', ')}
                - Stile: ${(prefs.styles || []).join(', ')}
                - No-Gos: ${(prefs.noGos || []).join(', ')}
                - Feedback: Mag ${likedTags.join(', ')}, Vermeide ${dislikedTags.join(', ')}
                - Vor kurzem gemacht: ${lastDoneTags.join(', ')}
                ${userPrompt ? `- NUTZER-WUNSCH: Berücksichtige bei den Vorschlägen besonders diese Idee: "${userPrompt}"` : ''}
                ` : '';

                const prompt = `Du bist ein kreativer Date-Planer. Generiere EXAKT 5 Date-Ideen für den Buchstaben "${letterKey}".
                
                STRIKTE REGELN:
                - Sprache: Deutsch
                - Format: NUR JSON Lines (JSONL). Jede einzelne Idee muss ein valides JSON-Objekt sein, exakt EINE Zeile pro Objekt.
                  KEIN umhüllendes JSON-Array! KEINE Kommas zwischen den Zeilen! START SOFORT MIT DEM ERSTEN { OBJEKT!
                  Beispielstruktur pro Zeile (alles auf einer Zeile!):
                  {"id": "...", "title": "...", "description": "...", "whyItFits": "...", "tags": ["Tag1"], "matchedPreferences": ["Stil1"], "getYourGuideSearch": "...", "getYourGuidePrice": "15€ - 30€", "getYourGuideCount": 3, "metadata": {"indoorOutdoor": "...", "durationTier": ["2-4h"], "budgetTier": ["low"], "prepLevel": "low", "weatherFit": "rain-ok"}}
                - Titel: EXAKT 1 einzelnes deutsches Wort, MUSS mit "${letterKey}" beginnen (z.B. für B: "Bowling", für K: "Klettern"). Kein Satz, keine Bindestriche, nur EIN Wort.
                - description: Max 6 Wörter, knapp und charmant.
                - tags: Mindestens 2 Tags (Relax, Food, Culture, Nature, Sport, Creative, Adventure, Home-only).
                - matchedPreferences: Wähle 2-3 exakte Begriffe aus den definierten Stilen/Vorlieben aus.
                - getYourGuideSearch: NUR für Aktivitäten, die man konkret als Tour, Ticket oder Erlebnis auf GetYourGuide BUCHEN kann (z.B. "Escape Room ${city || ''}", "Kochkurs ${city || ''}", "Stadtführung ${city || ''}", "Museum ${city || ''}"). NIEMALS für generische/freie Aktivitäten wie Wandern, Spazieren, Backen, Kochen zu Hause, Schwimmen, Wassersport, Joggen etc. Die Such-Query MUSS den Ortsnamen "${city || ''}" enthalten. Wenn kein konkretes buchbares Erlebnis existiert: getYourGuideSearch, getYourGuidePrice und getYourGuideCount KOMPLETT WEGLASSEN.
                - getYourGuidePrice: Geschätzte Preisspanne (z.B. "25€ - 45€"). Nur setzen wenn getYourGuideSearch gesetzt ist.
                - getYourGuideCount: Geschätzte Anzahl Ergebnisse (1-10). Nur setzen wenn getYourGuideSearch gesetzt ist.
                - Metadaten-Werte müssen exakt als JSON Arrays von Strings formatiert sein für durationTier und budgetTier.
                - Vermeide: ${dislikedTags.join(', ')} und Themen aus ${lastDoneTags.join(', ')}.
                ${prefContext}`;

                console.log('[AI] Calling Gemini API (Stream) with model gemini-2.5-flash...');
                const result = await model.generateContentStream(prompt);

                let yieldedCount = 0;
                let buffer = '';

                // A smarter chunk parser that balances brackets to find objects,
                // safely ignoring whether it's an array or split across lines.
                for await (const chunk of result.stream) {
                    buffer += chunk.text();

                    // Try to find valid top-level objects in the buffer
                    while (buffer.includes('{') && buffer.includes('}')) {
                        const startIndex = buffer.indexOf('{');
                        let braceCount = 0;
                        let endIndex = -1;
                        let insideString = false;
                        let escapeNext = false;

                        for (let i = startIndex; i < buffer.length; i++) {
                            const char = buffer[i];
                            if (escapeNext) {
                                escapeNext = false;
                                continue;
                            }
                            if (char === '\\') {
                                escapeNext = true;
                                continue;
                            }
                            if (char === '"') insideString = !insideString;
                            if (!insideString) {
                                if (char === '{') braceCount++;
                                if (char === '}') {
                                    braceCount--;
                                    if (braceCount === 0) {
                                        endIndex = i;
                                        break;
                                    }
                                }
                            }
                        }

                        if (endIndex !== -1) {
                            const jsonString = buffer.substring(startIndex, endIndex + 1);
                            buffer = buffer.substring(endIndex + 1); // Remove parsed part from buffer
                            try {
                                const idea = JSON.parse(jsonString) as AIIdea;
                                if (idea && idea.title) {
                                    idea.id = idea.id || Math.random().toString(36).substr(2, 9);
                                    yield idea;
                                    yieldedCount++;
                                }
                            } catch (e) {
                                console.warn('[AI] Stream chunk parse error for extracted object:', e);
                            }
                        } else {
                            // Incomplete object, wait for next chunk
                            break;
                        }
                    }
                }

                if (yieldedCount > 0) {
                    return; // Early return if we successfully yielded AI ideas
                } else {
                    console.warn('[AI] ⚠️ Gemini API Stream succeeded but yielded 0 items. Falling back to local database.');
                }

            } catch (error) {
                console.warn('[AI] ⚠️ Gemini API Stream Error – Fallback auf lokale Datenbank:', error);
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
        const localIdeas = [...baseList]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(a => ({
                id: Math.random().toString(36).substr(2, 9),
                title: a.text,
                description: 'Ein schöner Vorschlag basierend auf deiner Liste.',
                whyItFits: 'Passt zu deinen Basiseinstellungen.',
                tags: ['General'],
                metadata: {
                    indoorOutdoor: a.type as 'indoor' | 'outdoor' | 'both',
                    durationTier: ['60-120'] as UserPreferences['durationTier'],
                    budgetTier: ['medium'] as UserPreferences['budgetTier'],
                    prepLevel: 'low' as 'none' | 'low' | 'medium',
                    weatherFit: a.type === 'outdoor' ? 'needs-fair' as const : 'rain-ok' as const
                }
            }));

        for (const idea of localIdeas) {
            // Artificial delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 300));
            yield idea;
        }
    },

    async generateSummary(letter: string, proposal: string, notes: string): Promise<string> {
        if (!genAI) {
            return "KI-Dienst nicht verfügbar (API Key fehlt).";
        }

        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const prompt = `Fasse dieses Date humorvoll und charmant in 2-3 Sätzen zusammen für unser Reisetagebuch.
            
            Buchstabe: ${letter}
            Aktivität: ${proposal}
            Notizen vom Date: ${notes || 'Keine besonderen Notizen.'}
            `;

            console.log('[AI] Calling Gemini API to summarize round...');
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            console.warn('[AI] Error generating summary:', error);
            return "Leider konnte keine Zusammenfassung generiert werden.";
        }
    }
};
