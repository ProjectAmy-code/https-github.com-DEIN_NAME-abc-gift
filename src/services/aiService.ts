import { AI_ACTIVITIES } from './aiData';
import { storage } from '../storage';

export const aiService = {
    async generateIdeas(letter: string): Promise<string[]> {
        const settings = await storage.getSettings();
        const letterKey = letter.toUpperCase();
        const availableActivities = AI_ACTIVITIES[letterKey] || AI_ACTIVITIES['DEFAULT'];

        // Filter based on user preferences
        const filtered = availableActivities.filter(activity => {
            if (activity.type === 'both') return true;
            if (activity.type === 'indoor' && settings.activityFilters.indoor) return true;
            if (activity.type === 'outdoor' && settings.activityFilters.outdoor) return true;
            return false;
        });

        // Use a fallback if filtering is too strict
        const baseList = filtered.length > 0 ? filtered : availableActivities;

        // Shuffle and take top 5 to simulate "new" ideas each time
        return [...baseList]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5)
            .map(a => a.text);
    }
};
