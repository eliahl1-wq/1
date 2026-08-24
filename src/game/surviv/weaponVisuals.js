import { getSurvivWeaponFamily } from './weaponCatalog.js';

const FAMILY_DEFAULTS = Object.freeze({
    pistol: { style: 'pistol', length: 18, width: 6.2, stock: 'none', magazine: 'grip', barrel: 2.5, muzzleScale: 1.33 },
    revolver: { style: 'revolver', length: 23, width: 7.2, stock: 'none', magazine: 'cylinder', barrel: 7, muzzleScale: 1.75 },
    smg: { style: 'smg', length: 28, width: 7.8, stock: 'wire', magazine: 'stick', barrel: 4, muzzleScale: 1.98 },
    shotgun: { style: 'shotgun', length: 33, width: 6.2, stock: 'full', magazine: 'tube', barrel: 14, muzzleScale: 2.31 },
    assault: { style: 'rifle', length: 32, width: 7.4, stock: 'full', magazine: 'curved', barrel: 9, muzzleScale: 2.26 },
    dmr: { style: 'rifle', length: 36, width: 6.8, stock: 'full', magazine: 'box', barrel: 12, scope: 'short', muzzleScale: 2.57 },
    sniper: { style: 'rifle', length: 40, width: 6, stock: 'full', magazine: 'small', barrel: 17, scope: 'long', muzzleScale: 2.88 },
    lmg: { style: 'lmg', length: 35, width: 8.2, stock: 'full', magazine: 'box', barrel: 11, muzzleScale: 2.47 },
});

const GROUP_OVERRIDES = [
    [['m9', 'g18c', 'm93r', 'pistol'], { style: 'pistol', length: 18, width: 6, squareSlide: true }],
    [['p30l', 'm1911'], { style: 'pistol', length: 19.5, width: 5.7, squareSlide: false }],
    [['deagle50'], { style: 'pistol', length: 23, width: 7.2, barrel: 4, heavy: true, muzzleScale: 1.55 }],
    [['flaregun'], { style: 'pistol', length: 17, width: 8, barrel: 3, heavy: true, accent: '#b84b2e' }],
    [['lasrgun'], { style: 'pistol', length: 21, width: 6.3, barrel: 5, suppressor: true, accent: '#506a71' }],
    [['ot38', 'ots38', 'revolver'], { style: 'revolver', length: 23, width: 7.4, barrel: 7 }],
    [['peacemaker'], { style: 'revolver', length: 25, width: 7, barrel: 9, furniture: '#79502d' }],

    [['mac10'], { style: 'smg', length: 23, width: 9.2, stock: 'none', magazine: 'stick', barrel: 2.5, boxy: true, muzzleScale: 1.72 }],
    [['mp5', 'smg'], { style: 'smg', length: 29, width: 7, stock: 'fixed', magazine: 'curved', barrel: 4.5 }],
    [['ump9'], { style: 'smg', length: 31, width: 7.5, stock: 'skeleton', magazine: 'curved', barrel: 5 }],
    [['vector9', 'vector45'], { style: 'smg', length: 27, width: 8.5, stock: 'skeleton', magazine: 'stick', barrel: 3.2, angular: true }],
    [['cz3a1'], { style: 'smg', length: 28, width: 7, stock: 'wire', magazine: 'stick', barrel: 6, suppressor: true }],
    [['m1a1'], { style: 'smg', length: 33, width: 7.2, stock: 'full', magazine: 'stick', barrel: 7, furniture: '#765033' }],
    [['spudgun'], { style: 'smg', length: 28, width: 9.5, stock: 'fixed', magazine: 'drum', barrel: 6, accent: '#886139' }],
    [['flamethrower'], { style: 'special', length: 34, width: 10, stock: 'tank', magazine: 'tank', barrel: 13, accent: '#8b5031' }],

    [['m870', 'm1100', 'shotgun'], { style: 'shotgun', length: 33, width: 6.2, stock: 'full', magazine: 'tube', barrel: 14, furniture: '#82542f' }],
    [['mp220'], { style: 'shotgun', length: 29, width: 7.2, stock: 'full', magazine: 'tube', barrel: 13, barrelCount: 2, furniture: '#7c4e2a' }],
    [['spas12'], { style: 'shotgun', length: 34, width: 7.2, stock: 'skeleton', magazine: 'tube', barrel: 14 }],
    [['saiga12', 'usas12', 'super90', 'hawk12g'], { style: 'shotgun', length: 32, width: 7.4, stock: 'fixed', magazine: 'box', barrel: 11 }],
    [['m79'], { style: 'shotgun', length: 27, width: 8.5, stock: 'full', magazine: 'none', barrel: 9, furniture: '#7e522f' }],
    [['potatocannon'], { style: 'special', length: 34, width: 11, stock: 'fixed', magazine: 'tube', barrel: 15, accent: '#8d6337' }],

    [['ak47'], { style: 'rifle', length: 33, width: 7.3, stock: 'full', magazine: 'curved', barrel: 9, furniture: '#7d4f2b' }],
    [['m416', 'assault'], { style: 'rifle', length: 32, width: 7.2, stock: 'skeleton', magazine: 'curved', barrel: 8 }],
    [['m4a1s'], { style: 'rifle', length: 35, width: 6.8, stock: 'skeleton', magazine: 'curved', barrel: 12, suppressor: true }],
    [['scarh'], { style: 'rifle', length: 33, width: 7.5, stock: 'fixed', magazine: 'curved', barrel: 9, furniture: '#8a704b' }],
    [['famas', 'groza', 'grozas', 'an94'], { style: 'rifle', length: 29, width: 8.3, stock: 'bullpup', magazine: 'curved', barrel: 8, bullpup: true }],
    [['watergun', 'rainbowblaster'], { style: 'rifle', length: 30, width: 8.5, stock: 'fixed', magazine: 'tank', barrel: 8, accent: '#5f8790' }],
    [['m39emr', 'mk12spr', 'mk20ssr', 'dmr'], { style: 'rifle', length: 36, width: 6.8, stock: 'full', magazine: 'box', barrel: 12, scope: 'short' }],
    [['vss'], { style: 'rifle', length: 34, width: 6.7, stock: 'skeleton', magazine: 'box', barrel: 11, scope: 'short', suppressor: true, furniture: '#745033' }],
    [['m1garand', 'svd63', 'l86a2'], { style: 'rifle', length: 36, width: 6.5, stock: 'full', magazine: 'small', barrel: 13, furniture: '#765136' }],
    [['heartcannon'], { style: 'rifle', length: 35, width: 8, stock: 'full', magazine: 'box', barrel: 12, scope: 'short', accent: '#a95780' }],
    [['mosin', 'blr81', 'model94', 'sniper'], { style: 'rifle', length: 40, width: 5.8, stock: 'full', magazine: 'small', barrel: 17, scope: 'long', furniture: '#79502e' }],
    [['sv98', 'scoutelite'], { style: 'rifle', length: 40, width: 6.2, stock: 'skeleton', magazine: 'small', barrel: 17, scope: 'long' }],
    [['awms'], { style: 'rifle', length: 41, width: 6.8, stock: 'skeleton', magazine: 'small', barrel: 18, scope: 'long', suppressor: true }],

    [['dp28'], { style: 'lmg', length: 34, width: 8, stock: 'full', magazine: 'pan', barrel: 11, furniture: '#765033' }],
    [['m249', 'lmg'], { style: 'lmg', length: 35, width: 8.5, stock: 'fixed', magazine: 'box', barrel: 11 }],
    [['barm1918'], { style: 'lmg', length: 38, width: 6.8, stock: 'full', magazine: 'box', barrel: 14, furniture: '#765033' }],
    [['pkp', 'pkm'], { style: 'lmg', length: 37, width: 8.5, stock: 'full', magazine: 'box', barrel: 13, furniture: '#745033' }],
    [['qbb97'], { style: 'lmg', length: 32, width: 8.8, stock: 'bullpup', magazine: 'drum', barrel: 10, bullpup: true }],
    [['m134'], { style: 'lmg', length: 37, width: 11, stock: 'grip', magazine: 'drum', barrel: 15, barrelCount: 3 }],
    [['bugle'], { style: 'bugle', length: 25, width: 11, stock: 'none', magazine: 'none', barrel: 14, accent: '#b78a32' }],
];

const OVERRIDES = Object.freeze(Object.fromEntries(
    GROUP_OVERRIDES.flatMap(([ids, profile]) => ids.map(id => [id, Object.freeze(profile)])),
));

function normalizeWeaponId(id) {
    const value = String(id || 'fists').toLowerCase();
    if (value.startsWith('dual')) return value.slice(4);
    return value;
}

export function getSurvivWeaponVisualProfile(id) {
    const weaponId = String(id || 'fists').toLowerCase();
    if (weaponId === 'fists' || weaponId === 'knife') {
        return Object.freeze({ id: weaponId, style: weaponId, dual: false, muzzleScale: 0 });
    }
    const baseId = normalizeWeaponId(weaponId);
    const family = getSurvivWeaponFamily(weaponId);
    return Object.freeze({
        ...(FAMILY_DEFAULTS[family] || FAMILY_DEFAULTS.pistol),
        ...(OVERRIDES[baseId] || {}),
        id: weaponId,
        baseId,
        family,
        dual: weaponId.startsWith('dual'),
        metal: '#303b3e',
        dark: '#151d1f',
        furniture: OVERRIDES[baseId]?.furniture || '#303936',
    });
}

export function getSurvivWeaponMuzzleScale(id) {
    return getSurvivWeaponVisualProfile(id).muzzleScale || 1.3;
}
