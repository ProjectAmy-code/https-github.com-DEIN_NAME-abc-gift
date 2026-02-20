import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = "AIzaSyCLcKd5H3OaM3usSXK6x_Vnz9u-8Eo6fVU";
if (!API_KEY) throw new Error("No API key");

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const prompt = `Du bist ein kreativer Date-Planer. Generiere EXAKT 5 Date-Ideen für den Buchstaben "U".
                
STRIKTE REGELN:
- Sprache: Deutsch
- Format: NUR JSON Lines (JSONL). Jede einzelne Idee muss ein valides JSON-Objekt sein, exakt EINE Zeile pro Objekt.
  KEIN umhüllendes JSON-Array! KEINE Kommas zwischen den Zeilen! START SOFORT MIT DEM ERSTEN { OBJEKT!
  Beispielstruktur pro Zeile (alles auf einer Zeile!):
  {"id": "...", "title": "...", "description": "...", "whyItFits": "...", "tags": ["Tag1"], "matchedPreferences": ["Stil1"], "getYourGuideSearch": "...", "getYourGuidePrice": "15€ - 30€", "getYourGuideCount": 3, "metadata": {"indoorOutdoor": "...", "durationTier": ["2-4h"], "budgetTier": ["low"], "prepLevel": "low", "weatherFit": "rain-ok"}}
- Titel: EXAKT 1 einzelnes deutsches Wort, MUSS mit "U" beginnen (z.B. für B: "Bowling", für K: "Klettern"). Kein Satz, keine Bindestriche, nur EIN Wort.
- description: Max 6 Wörter, knapp und charmant.
- tags: Mindestens 2 Tags (Relax, Food, Culture, Nature, Sport, Creative, Adventure, Home-only).
- matchedPreferences: Wähle 2-3 exakte Begriffe aus den definierten Stilen/Vorlieben aus.
- getYourGuideSearch: NUR für Aktivitäten, die man konkret als Tour, Ticket oder Erlebnis auf GetYourGuide BUCHEN kann (z.B. "Escape Room", "Kochkurs", "Stadtführung", "Museum"). NIEMALS für generische/freie Aktivitäten wie Wandern, Spazieren, Backen, Kochen zu Hause, Schwimmen, Wassersport, Joggen etc. Die Such-Query MUSS den Ortsnamen "" enthalten. Wenn kein konkretes buchbares Erlebnis existiert: getYourGuideSearch, getYourGuidePrice und getYourGuideCount KOMPLETT WEGLASSEN.
- getYourGuidePrice: Geschätzte Preisspanne (z.B. "25€ - 45€"). Nur setzen wenn getYourGuideSearch gesetzt ist.
- getYourGuideCount: Geschätzte Anzahl Ergebnisse (1-10). Nur setzen wenn getYourGuideSearch gesetzt ist.
- Metadaten-Werte müssen exakt als JSON Arrays von Strings formatiert sein für durationTier und budgetTier.
- Vermeide:  und Themen aus .`;

async function test() {
    console.log("Calling Gemini...");
    const result = await model.generateContentStream(prompt);

    let fullOutput = "";
    for await (const chunk of result.stream) {
        fullOutput += chunk.text();
    }
    console.log("RAW GEMINI OUTPUT:\n", fullOutput);
}

test();
