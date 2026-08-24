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
    [['mosin'], { style: 'rifle', length: 40, width: 5.8, stock: 'full', magazine: 'small', barrel: 17, scope: null, furniture: '#79502e' }],
    [['blr81', 'model94', 'sniper'], { style: 'rifle', length: 40, width: 5.8, stock: 'full', magazine: 'small', barrel: 17, scope: 'long', furniture: '#79502e' }],
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

const SIDE_ART_CACHE = new Map();

const number = value => Math.round(value * 10) / 10;
const rectPath = (x, y, width, height) => `M${number(x)} ${number(y)}h${number(width)}v${number(height)}h-${number(width)}Z`;
const polygonPath = points => `M${points.map(([x, y]) => `${number(x)} ${number(y)}`).join('L')}Z`;
const ellipsePath = (cx, cy, rx, ry) => [
    `M${number(cx - rx)} ${number(cy)}`,
    `a${number(rx)} ${number(ry)} 0 1 0 ${number(rx * 2)} 0`,
    `a${number(rx)} ${number(ry)} 0 1 0 -${number(rx * 2)} 0Z`,
].join('');

const fixedPart = (d, role = 'metal', strokeWidth = 0) => Object.freeze({ d, role, strokeWidth });
const fixedSideArt = (parts, cuts = []) => Object.freeze({
    parts: Object.freeze(parts),
    cuts: Object.freeze(cuts),
});

// Purpose-built silhouettes for the standard 16-gun roster. These use the
// same direction, proportions and defining negative spaces as the approved
// loadout reference instead of falling back to a generic family template.
const STANDARD_SIDE_ART = Object.freeze({
    m9: fixedSideArt([
        fixedPart('M20 11L27 8H76L82 12V21H29L21 18Z'),
        fixedPart('M26 19H47L42 41H24L18 34Z', 'furniture'),
        fixedPart('M47 21C46 31 59 32 60 21', 'metal', 2.7),
        fixedPart('M25 7H29V11H25ZM70 7H74V11H70Z', 'dark'),
    ]),
    ot38: fixedSideArt([
        fixedPart('M20 13L27 9H76L82 13V21H30L22 19Z'),
        fixedPart('M27 20H46L42 41H24L18 34Z', 'furniture'),
        fixedPart(ellipsePath(47, 20, 7, 6), 'metal'),
        fixedPart('M47 21C46 31 59 31 60 21', 'metal', 2.6),
        fixedPart('M18 12L22 8L27 13Z', 'dark'),
    ]),
    mac10: fixedSideArt([
        fixedPart('M25 10H67L72 14V24H25Z'),
        fixedPart('M12 14H27V20H12Z', 'dark'),
        fixedPart('M39 22H52L51 42H40Z', 'dark'),
        fixedPart('M55 22H64L61 34H55Z', 'furniture'),
        fixedPart('M67 12L88 8V30H84V13L68 17', 'dark', 2.7),
        fixedPart('M51 23C51 31 62 31 63 22', 'metal', 2.5),
    ]),
    mp5: fixedSideArt([
        fixedPart('M24 13H64L70 17V25H24Z'),
        fixedPart('M7 16H26V21H7Z', 'dark'),
        fixedPart('M42 23H53C55 31 51 38 44 41C47 34 47 29 42 23Z', 'dark'),
        fixedPart('M56 23H65L62 35H56Z', 'dark'),
        fixedPart('M67 15L91 12V31H87V17L68 20', 'furniture', 3),
        fixedPart('M53 23C52 31 64 31 66 23', 'metal', 2.5),
        fixedPart('M15 11V16M20 10V16', 'dark', 2),
    ]),
    m870: fixedSideArt([
        fixedPart('M4 17L12 13L31 12L39 17L35 25L18 27L7 25Z', 'furniture'),
        fixedPart('M31 13H52L58 17V24H33Z'),
        fixedPart('M52 15H96V19H52ZM52 21H90V24H52Z', 'dark'),
        fixedPart('M58 20H76V27H57Z', 'furniture'),
        fixedPart('M39 23C39 30 49 30 51 23', 'metal', 2.2),
    ]),
    mp220: fixedSideArt([
        fixedPart('M5 17L15 12L34 13L43 18L38 25L18 28L7 25Z', 'furniture'),
        fixedPart('M34 14H51L56 18V24H36Z'),
        fixedPart('M50 15H96V19H50ZM50 21H96V25H50Z', 'dark'),
        fixedPart('M40 23C40 30 50 30 52 23', 'metal', 2.1),
    ]),
    ak47: fixedSideArt([
        fixedPart('M6 17H24V22H6ZM12 12V17M17 13V17', 'dark', 2.2),
        fixedPart('M23 13H62L68 17V25H23Z'),
        fixedPart('M42 23H54C57 31 53 39 44 42C49 35 48 29 42 23Z', 'dark'),
        fixedPart('M58 23H66L63 35H57Z', 'dark'),
        fixedPart('M65 15L78 12L94 16V27L78 25L66 21Z', 'furniture'),
        fixedPart('M54 23C53 30 63 31 65 23', 'metal', 2.4),
    ]),
    m416: fixedSideArt([
        fixedPart('M5 16H24V21H5ZM10 12V16', 'dark', 2.2),
        fixedPart('M23 12H67L72 17V25H23Z'),
        fixedPart('M30 9H51V12H30Z', 'dark'),
        fixedPart('M48 23H59L57 39H49Z', 'dark'),
        fixedPart('M61 23H69L66 35H60Z', 'dark'),
        fixedPart('M69 15L91 13V30H87V18L70 20', 'furniture', 3),
        fixedPart('M58 23C57 31 68 31 70 23', 'metal', 2.4),
    ]),
    famas: fixedSideArt([
        fixedPart('M4 18H25V22H4ZM12 13V18', 'dark', 2.2),
        fixedPart('M24 14H80L91 18V29L75 27L68 24H24Z'),
        fixedPart('M31 13V7H60V14M35 11H56', 'metal', 4),
        fixedPart('M38 23H49L46 38H37Z', 'dark'),
        fixedPart('M67 24H75L74 37H68Z', 'dark'),
        fixedPart('M46 23C45 31 57 31 59 23', 'metal', 2.4),
    ], [ellipsePath(42, 11, 5, 2.3)]),
    vss: fixedSideArt([
        fixedPart('M5 16L28 13L36 18L31 26L5 26Z', 'furniture'),
        fixedPart('M30 13H64L70 17V25H30Z'),
        fixedPart('M60 16H96V23H60Z', 'dark'),
        fixedPart('M40 8H63V13H40ZM37 7H42V14H37ZM61 7H66V14H61Z', 'dark'),
        fixedPart('M46 23H56L55 35H47Z', 'dark'),
        fixedPart('M56 23C55 30 65 31 67 23', 'metal', 2.3),
    ], [ellipsePath(14, 21, 5, 3), ellipsePath(25, 20, 4, 3)]),
    mosin: fixedSideArt([
        fixedPart('M4 18H47V21H4ZM12 14V18', 'dark', 2),
        fixedPart('M45 15H66L72 19V24H45Z'),
        fixedPart('M64 16L75 13L95 16V27L83 26L73 23L65 22Z', 'furniture'),
        fixedPart('M58 23C58 29 68 29 70 23', 'metal', 2.1),
        fixedPart('M54 12L57 8L60 13', 'dark', 2),
    ]),
    awms: fixedSideArt([
        fixedPart('M3 17H43V22H3Z', 'dark'),
        fixedPart('M41 13H68L73 18V25H41Z'),
        fixedPart('M48 7H69V12H48ZM45 6H50V13H45ZM67 6H72V13H67Z', 'dark'),
        fixedPart('M54 24H63L62 35H55Z', 'dark'),
        fixedPart('M67 15L79 12L96 16V29L83 27L77 24L68 23Z', 'furniture'),
        fixedPart('M63 23C62 30 72 31 74 23', 'metal', 2.3),
    ], [ellipsePath(84, 21, 5, 3.5)]),
    dp28: fixedSideArt([
        fixedPart('M4 17H43V22H4ZM12 13V17', 'dark', 2.2),
        fixedPart('M41 14H67L72 18V25H41Z'),
        fixedPart(ellipsePath(55, 12, 17, 7), 'dark'),
        fixedPart('M65 16L78 14L95 18V28L83 27L72 23L66 22Z', 'furniture'),
        fixedPart('M48 23C48 30 59 30 61 23', 'metal', 2.2),
        fixedPart('M34 22L29 42M38 22L43 41', 'dark', 2),
    ]),
    m249: fixedSideArt([
        fixedPart('M4 16H34V22H4ZM13 11V16M20 13V16', 'dark', 2.2),
        fixedPart('M32 12H69L74 17V26H32Z'),
        fixedPart('M43 11C44 4 60 4 62 11', 'dark', 2.5),
        fixedPart('M41 24H54V42H41Z', 'dark'),
        fixedPart('M62 24H70L68 36H61Z', 'dark'),
        fixedPart('M69 15L82 12L96 16V29L82 27L72 23Z', 'furniture'),
        fixedPart('M26 22L22 41M30 22L36 40', 'dark', 2),
    ]),
    m4a1s: fixedSideArt([
        fixedPart('M3 15H23V23H3Z', 'dark'),
        fixedPart('M22 17H39V21H22Z', 'dark'),
        fixedPart('M37 12H70L75 17V25H37Z'),
        fixedPart('M45 8H61V12H45Z', 'dark'),
        fixedPart('M50 23H60L58 39H50Z', 'dark'),
        fixedPart('M64 23H72L69 35H63Z', 'dark'),
        fixedPart('M72 15L93 13V30H89V18L73 20', 'furniture', 3),
    ]),
});

function buildFirearmSideArt(profile) {
    const parts = [];
    const cuts = [];
    const add = (d, role = 'metal', strokeWidth = 0) => parts.push(Object.freeze({ d, role, strokeWidth }));
    const cut = d => cuts.push(d);
    const line = (d, role = 'metal', strokeWidth = 2.1) => add(d, role, strokeWidth);

    if (profile.style === 'fists') return { parts, cuts };
    if (profile.style === 'knife') {
        add(polygonPath([[6, 18], [39, 18], [92, 7], [96, 11], [41, 27], [6, 27]]), 'metal');
        add(rectPath(5, 15, 37, 16), 'furniture');
        add(rectPath(39, 13, 4, 20), 'dark');
        return { parts, cuts };
    }

    if (profile.style === 'bugle') {
        line('M9 23C18 8 36 8 47 20C54 28 45 34 35 28C27 23 32 16 43 17', 'accent', 4.2);
        add(polygonPath([[43, 15], [91, 7], [91, 33], [43, 25]]), 'accent');
        return { parts, cuts };
    }

    if (profile.style === 'pistol' || profile.style === 'revolver') {
        const revolver = profile.style === 'revolver';
        const longBarrel = revolver ? 89 : (profile.heavy ? 84 : 78);
        if (revolver) {
            add(polygonPath([[23, 15], [36, 12], [55, 13], [60, 18], [55, 24], [31, 24], [23, 21]]));
            add(ellipsePath(48, 19, 8.5, 8), 'metal');
            add(rectPath(55, 15, longBarrel - 55, 6), 'metal');
            add(rectPath(62, 21, longBarrel - 67, 2.2), 'dark');
            add(polygonPath([[29, 22], [45, 23], [40, 40], [24, 39], [19, 34]]), 'furniture');
            add(polygonPath([[22, 14], [26, 9], [29, 15]]), 'dark');
        } else {
            add(polygonPath([[20, 11], [longBarrel, 11], [82, 14], [82, 22], [24, 22], [18, 18]]));
            add(rectPath(25, 21, Math.max(35, longBarrel - 31), 5), 'dark');
            add(polygonPath([[25, 23], [46, 23], [42, 40], [24, 40], [18, 34]]), 'furniture');
            add(rectPath(longBarrel - 2, 13, Math.max(5, 85 - longBarrel), 5), 'dark');
            add(rectPath(26, 8, 3, 3), 'dark');
            add(rectPath(longBarrel - 8, 8, 3, 3), 'dark');
        }
        line('M44 23C44 31 55 32 57 23', 'metal', 2.5);
        if (profile.suppressor) add(rectPath(80, 13, 17, 7), 'dark');
        return { parts, cuts };
    }

    const receiverStart = profile.bullpup ? 22 : (profile.stock === 'none' ? 18 : 31);
    const receiverEnd = profile.style === 'shotgun' ? 58 : 62;
    const barrelEnd = profile.suppressor ? 83 : 94;
    const bodyTop = profile.style === 'lmg' ? 12 : 14;
    const bodyBottom = profile.style === 'lmg' ? 27 : 25;

    if (profile.baseId === 'awms') {
        add(polygonPath([[4, 14], [16, 11], [35, 14], [39, 21], [34, 29], [19, 28], [13, 24], [4, 24]]), 'furniture');
        cut(ellipsePath(22, 21, 6.5, 4.5));
    } else if (profile.stock === 'wire' || profile.stock === 'skeleton') {
        line(`M31 16L8 12L5 18L31 22`, 'furniture', 3.2);
        line('M7 12L5 27', 'furniture', 3.2);
    } else if (profile.stock === 'bullpup') {
        add(polygonPath([[5, 15], [31, 13], [39, 18], [35, 29], [20, 30], [16, 24], [5, 24]]), 'furniture');
        cut(ellipsePath(22, 23, 5.2, 4));
    } else if (!['none', 'grip', 'tank'].includes(profile.stock)) {
        add(polygonPath([[4, 15], [12, 11], [33, 14], [36, 22], [24, 27], [10, 26], [4, 23]]), 'furniture');
    }

    if (profile.stock === 'tank') add(ellipsePath(17, 22, 11, 12), 'accent');

    if (profile.style === 'shotgun') {
        add(polygonPath([[receiverStart, 14], [57, 14], [61, 18], [58, 24], [receiverStart, 24]]));
        const pumpX = profile.barrelCount > 1 ? 59 : 62;
        add(rectPath(56, 16, 37, profile.barrelCount > 1 ? 7 : 4), 'dark');
        if (profile.barrelCount > 1) line('M58 23H94', 'dark', 2.5);
        if (profile.barrelCount <= 1) add(polygonPath([[pumpX, 20], [78, 20], [75, 28], [59, 27]]), 'furniture');
    } else if (profile.style === 'special') {
        add(polygonPath([[receiverStart, 12], [62, 12], [68, 18], [62, 27], [receiverStart, 27]]));
        add(ellipsePath(49, 20, 10, 9), 'accent');
        add(rectPath(62, 16, 28, 7), 'dark');
    } else {
        add(polygonPath([[receiverStart, bodyTop], [receiverEnd, bodyTop], [67, 18], [64, bodyBottom], [receiverStart, bodyBottom]]));
        add(rectPath(61, 15.5, 19, 8.5), profile.style === 'lmg' ? 'furniture' : 'metal');
        add(rectPath(79, 18, barrelEnd - 79, profile.style === 'lmg' ? 4 : 3), 'dark');
    }

    // The grip, magazine and trigger guard carry most of the named-gun identity
    // at slot size. They intentionally stay chunky enough to survive scaling.
    const gripX = profile.bullpup ? 50 : 45;
    add(polygonPath([[gripX, 24], [gripX + 8, 24], [gripX + 5, 37], [gripX - 1, 37]]), 'dark');
    line(`M${gripX + 7} 24C${gripX + 7} 31 ${gripX + 17} 31 ${gripX + 18} 23`, 'metal', 2.3);

    const magX = profile.bullpup ? 28 : 57;
    if (profile.magazine === 'pan') {
        add(ellipsePath(49, 12.5, 15, 6.5), 'dark');
    } else if (profile.magazine === 'drum') {
        add(ellipsePath(magX + 2, 29, 7.5, 8), 'dark');
    } else if (profile.magazine === 'tank') {
        add(ellipsePath(magX, 29, 8.5, 9), 'accent');
    } else if (profile.magazine === 'curved') {
        add(`M${magX - 4} 24H${magX + 5}C${magX + 7} 31 ${magX + 3} 37 ${magX - 3} 40C${magX} 34 ${magX} 29 ${magX - 4} 24Z`, 'dark');
    } else if (['box', 'stick', 'small'].includes(profile.magazine)) {
        const width = profile.magazine === 'stick' ? 6 : profile.magazine === 'small' ? 7 : 10;
        const height = profile.magazine === 'stick' ? 16 : profile.magazine === 'small' ? 10 : 14;
        add(polygonPath([[magX - width / 2, 24], [magX + width / 2, 24], [magX + width / 2 - 1, 24 + height], [magX - width / 2 + 1, 24 + height]]), 'dark');
    }

    if (profile.scope) {
        const scopeStart = profile.scope === 'long' ? 37 : 42;
        const scopeLength = profile.scope === 'long' ? 28 : 20;
        add(rectPath(scopeStart, 8, scopeLength, 5), 'dark');
        add(rectPath(scopeStart - 3, 6.5, 4, 8), 'dark');
        add(rectPath(scopeStart + scopeLength - 1, 6.5, 4, 8), 'dark');
    }

    if (profile.suppressor) add(rectPath(81, 16, 16, 7), 'dark');
    if (profile.style === 'lmg') {
        line('M73 24L69 40M75 24L82 39', 'dark', 1.8);
        if (profile.magazine === 'box') add(rectPath(53, 25, 13, 13), 'furniture');
    }
    if (profile.barrelCount >= 3) {
        line('M76 15H96M76 20H98M76 25H96', 'dark', 2.2);
    }

    return { parts, cuts };
}

/**
 * Shared side-view art for the HUD and weapon loot. Keeping the path list in
 * one place guarantees that the coloured ground item has the exact same
 * exterior silhouette as its monochrome loadout icon.
 */
export function getSurvivWeaponSideArt(id) {
    const weaponId = String(id || 'fists').toLowerCase();
    if (SIDE_ART_CACHE.has(weaponId)) return SIDE_ART_CACHE.get(weaponId);
    const profile = getSurvivWeaponVisualProfile(weaponId);
    const fixedGeometry = STANDARD_SIDE_ART[profile.baseId];
    const art = Object.freeze({
        id: weaponId,
        profile,
        viewBox: Object.freeze([0, 0, 100, 44]),
        instances: Object.freeze(profile.dual
            ? [
                Object.freeze({ x: 0, y: 2, scaleX: 0.52, scaleY: 0.9 }),
                Object.freeze({ x: 47, y: 2, scaleX: 0.52, scaleY: 0.9 }),
            ]
            : [Object.freeze({ x: 0, y: 0, scaleX: 1, scaleY: 1 })]),
        ...(fixedGeometry || buildFirearmSideArt(profile)),
    });
    SIDE_ART_CACHE.set(weaponId, art);
    return art;
}

export function getSurvivWeaponMuzzleScale(id) {
    return getSurvivWeaponVisualProfile(id).muzzleScale || 1.3;
}
