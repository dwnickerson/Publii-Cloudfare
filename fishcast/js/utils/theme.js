import { storage } from '../services/storage.js';

export function applySavedTheme() {
    const savedTheme = storage.getTheme();
    const theme = savedTheme === 'dark' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', theme);
    return theme;
}
