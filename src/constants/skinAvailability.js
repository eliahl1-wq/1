// Temporary visibility switch. Artwork and purchased entitlements are retained.
const hidden = new Set(['prism', 'agar:prism', 'leviathan', 'slither:leviathan']);
export const isHiddenSkin = value => hidden.has(value);
export const isVisibleSkinProduct = product => !isHiddenSkin(product.skinId || product.value) && !isHiddenSkin(product.productId || product.id);
export const visibleSkinSelection = value => isHiddenSkin(value) ? '#c080ff' : value;
