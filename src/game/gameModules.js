export const loadAgarGame = () => import('./agar/Game.jsx');
export const loadSlitherGame = () => import('./slither/SlitherGame.jsx');
export const loadSurvivGame = () => import('./surviv/SurvivGame.jsx');

export function preloadGameForMode(mode) {
    if (String(mode || '').includes('slither')) return loadSlitherGame();
    if (String(mode || '').includes('surviv')) return loadSurvivGame();
    if (String(mode || '').includes('agar')) return loadAgarGame();
    return Promise.resolve();
}
