function defineSkin(id, name, color, usdPrice = 0) {
    return Object.freeze({
        id,
        name,
        color,
        usdPrice,
        futureAgarPrice: '',
    });
}

/**
 * Existing skins stay free and selectable exactly as before.
 * futureAgarPrice intentionally remains empty until live AGAR pricing exists.
 */
export const SKIN_CATALOG = Object.freeze([
    defineSkin('rainbow', 'Rainbow', 'random'),
    defineSkin('random-color', 'Random', 'random_color'),
    defineSkin('lavender-purple', 'Lavender Purple', '#c080ff'),
    defineSkin('indigo-blue', 'Indigo Blue', '#9099ff'),
    defineSkin('turquoise-cyan', 'Turquoise Cyan', '#80d0d0'),
    defineSkin('lime-green', 'Lime Green', '#80ff80'),
    defineSkin('tinted-yellow', 'Tinted Yellow', '#eeee70'),
    defineSkin('orange', 'Orange', '#ffa060'),
    defineSkin('pink-red', 'Pink Red', '#ff9050'),
    defineSkin('dark-red', 'Dark Red', '#ff4040'),
    defineSkin('magenta', 'Magenta', '#e030e0'),
]);

export const CHROMA_SKINS = Object.freeze(
    SKIN_CATALOG.filter((skin) => skin.color.startsWith('#')),
);

export const CHROMA_SKIN_COLORS = Object.freeze(
    CHROMA_SKINS.map((skin) => skin.color),
);

export function calculateFutureAgarPrice(skin, liveAgarPriceUsd) {
    if (!skin || !Number.isFinite(liveAgarPriceUsd) || liveAgarPriceUsd <= 0) return '';
    // TODO: Surface this calculated value only when AGAR skin purchases are enabled.
    return Number(skin.usdPrice) / liveAgarPriceUsd;
}
