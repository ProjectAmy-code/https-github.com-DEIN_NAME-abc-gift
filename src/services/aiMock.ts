const SUGGESTIONS: Record<string, string[]> = {
    'A': ['Aquarium', 'Alpin-Ausflug', 'Abendessen', 'Angeln', 'Atelierbesuch'],
    'B': ['Bowling', 'Brunch', 'Barbesuch', 'Billard', 'Ballett'],
    'C': ['Casino', 'Camping', 'Cocktails', 'Canyoning', 'Chillen'],
    'D': ['Dart', 'Dinner', 'Disco', 'Draisinenfahrt', 'Döner-Date'],
    'E': ['Eislaufen', 'Eisessen', 'Escape-Room', 'E-Bike-Tour', 'Entspannung'],
    'F': ['Fondue', 'Frühstück', 'Fahrradtour', 'Freizeitpark', 'Fotografie'],
    'G': ['Grillen', 'Go-Kart', 'Golfen', 'Galeriebesuch', 'Gärtnern'],
    'H': ['Hochseilgarten', 'Hamam', 'Hüttenabend', 'Helikopterflug', 'Hotel-Nacht'],
    'I': ['Indoor-Ski', 'Inseltour', 'Iglu-Übernachtung', 'Improvisationstheater', 'Inlineskating'],
    'J': ['Jazz-Abend', 'Jogging', 'Jenga-Nacht', 'Jollensegeln', 'Jodeln'],
    'K': ['Kino', 'Kabarett', 'Kanufahren', 'Klettern', 'Kegeln'],
    'L': ['Laser-Tag', 'Lunch', 'Lesung', 'Lagerfeuer', 'Limonaden-Tasting'],
    'M': ['Museum', 'Minigolf', 'Massage', 'Musical', 'Malkurs'],
    'N': ['Nachtwanderung', 'Nightlife', 'Nordic-Walking', 'Naturpark', 'Naschen'],
    'O': ['Oper', 'Oldtimer-Fahrt', 'Orient-Essen', 'Obstpflücken', 'Orgelkonzert'],
    'P': ['Picknick', 'Paintball', 'Planetarium', 'Pokerabend', 'Paragliding'],
    'Q': ['Quizabend', 'Quadtour', 'Quellbesuch', 'Quiche-Backen', 'Quatschen'],
    'R': ['Radtour', 'Restaurantbesuch', 'Rudern', 'Reiten', 'Rodeln'],
    'S': ['Sauna', 'Sightseeing', 'Skifahren', 'Surfen', 'Schnitzeljagd'],
    'T': ['Theater', 'Therme', 'Tanzkurs', 'Tauchen', 'Tennis'],
    'U': ['U-Boot-Tour', 'Urlaub', 'Unterhaltung', 'U-Bahn-Rallye', 'Urwald-Trip'],
    'V': ['Varieté', 'Verkostung', 'Vernissage', 'Volleyball', 'Videoabend'],
    'W': ['Wandern', 'Wellness', 'Weinprobe', 'Workshop', 'Wasserski'],
    'X': ['Xylophon-Konzert', 'Xbox-Nacht', 'XXL-Burger', 'X-Mas-Markt', 'X-Hattrick'],
    'Y': ['Yoga', 'Yacht-Trip', 'YouTube-Abend', 'Yam-Essen', 'Yachting'],
    'Z': ['Zoo', 'Zirkus', 'Zumba', 'Zaubershow', 'Zelten'],
    'DEFAULT': ['Ausflug', 'Essen', 'Kino', 'Sport', 'Überraschung']
};

export const aiMock = {
    generateIdeas: async (letter: string): Promise<string[]> => {
        // Simulierte API-Verzögerung
        await new Promise(resolve => setTimeout(resolve, 1500));

        const ideas = SUGGESTIONS[letter.toUpperCase()] || SUGGESTIONS['DEFAULT'];
        // Shuffle the array to simulate new ideas each time
        return [...ideas].sort(() => Math.random() - 0.5);
    }
};
