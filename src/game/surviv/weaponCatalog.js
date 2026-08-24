const weapon = (label, family, ammoType, clipSize, rarity = null) => Object.freeze({
    label,
    family,
    ammoType,
    clipSize,
    rarity: rarity || (['sniper', 'lmg'].includes(family)
        ? 'military'
        : (['shotgun', 'assault', 'dmr'].includes(family) ? 'rare' : 'common')),
});

// The full named firearm roster from classic Surviv.io. Internal ids are kept
// URL/socket friendly; every player-facing label uses the original spelling.
export const SURVIV_WEAPON_CATALOG = Object.freeze({
    m9: weapon('M9', 'pistol', '9mm', 15),
    p30l: weapon('P30L', 'pistol', '9mm', 15),
    mp5: weapon('MP5', 'smg', '9mm', 30),
    mac10: weapon('MAC-10', 'smg', '9mm', 32),
    ump9: weapon('UMP9', 'smg', '9mm', 30),
    vector9: weapon('Vector (9mm)', 'smg', '9mm', 33),
    g18c: weapon('G18C', 'pistol', '9mm', 17),
    m93r: weapon('M93R', 'pistol', '9mm', 20),
    cz3a1: weapon('CZ-3A1', 'smg', '9mm', 30),
    vss: weapon('VSS', 'dmr', '9mm', 20),
    flamethrower: weapon('Flame Thrower', 'smg', '9mm', 60),

    m1100: weapon('M1100', 'shotgun', '12g', 4),
    m870: weapon('M870', 'shotgun', '12g', 5),
    mp220: weapon('MP220', 'shotgun', '12g', 2),
    saiga12: weapon('Saiga-12', 'shotgun', '12g', 5),
    spas12: weapon('SPAS-12', 'shotgun', '12g', 9),
    usas12: weapon('USAS-12', 'shotgun', '12g', 10),
    super90: weapon('Super 90', 'shotgun', '12g', 8),
    hawk12g: weapon('Hawk 12G', 'shotgun', '12g', 5),
    lasrgun: weapon('Lasr Gun', 'pistol', '12g', 5),

    ak47: weapon('AK-47', 'assault', '762', 30),
    ot38: weapon('OT-38', 'revolver', '762', 5),
    ots38: weapon('OTs-38', 'revolver', '762', 5),
    m39emr: weapon('M39 EMR', 'dmr', '762', 20),
    dp28: weapon('DP-28', 'lmg', '762', 60),
    mosin: weapon('Mosin-Nagant', 'sniper', '762', 5),
    scarh: weapon('SCAR-H', 'assault', '762', 20),
    barm1918: weapon('BAR M1918', 'lmg', '762', 20),
    sv98: weapon('SV-98', 'sniper', '762', 10),
    groza: weapon('Groza', 'assault', '762', 30),
    grozas: weapon('Groza-S', 'assault', '762', 30),
    an94: weapon('AN-94', 'assault', '762', 30),
    m1garand: weapon('M1 Garand', 'dmr', '762', 8),
    pkp: weapon('PKP Pecheneg', 'lmg', '762', 200),
    svd63: weapon('SVD-63', 'dmr', '762', 10),
    blr81: weapon('BLR 81', 'sniper', '762', 5),
    pkm: weapon('PKM', 'lmg', '762', 100),
    m134: weapon('M134', 'lmg', '762', 200),
    watergun: weapon('Water Gun', 'assault', '762', 30),

    famas: weapon('FAMAS', 'assault', '556', 25),
    m249: weapon('M249', 'lmg', '556', 100),
    m416: weapon('M416', 'assault', '556', 30),
    m4a1s: weapon('M4A1-S', 'assault', '556', 30),
    mk12spr: weapon('Mk 12 SPR', 'dmr', '556', 20),
    qbb97: weapon('QBB-97', 'lmg', '556', 75),
    scoutelite: weapon('Scout Elite', 'sniper', '556', 5),
    l86a2: weapon('L86A2', 'dmr', '556', 30),

    m1911: weapon('M1911', 'pistol', '45acp', 7),
    m1a1: weapon('M1A1', 'smg', '45acp', 30),
    vector45: weapon('Vector (.45 ACP)', 'smg', '45acp', 25),
    model94: weapon('Model 94', 'sniper', '45acp', 8),
    peacemaker: weapon('Peacemaker', 'revolver', '45acp', 6),
    deagle50: weapon('DEagle 50', 'pistol', '50ae', 7),
    awms: weapon('AWM-S', 'sniper', '308', 5),
    mk20ssr: weapon('Mk 20 SSR', 'dmr', '308', 10),
    m79: weapon('M79', 'shotgun', '40mm', 1),
    flaregun: weapon('Flare Gun', 'pistol', 'flare', 1),
    potatocannon: weapon('Potato Cannon', 'shotgun', 'potato', 4),
    spudgun: weapon('Spud Gun', 'smg', 'potato', 30),
    heartcannon: weapon('Heart Cannon', 'dmr', 'heart', 10),
    rainbowblaster: weapon('Rainbow Blaster', 'assault', 'heart', 30),
    bugle: weapon('Bugle', 'pistol', 'bugle', 5),

    dualm9: weapon('Dual M9', 'pistol', '9mm', 30),
    dualm93r: weapon('Dual M93R', 'pistol', '9mm', 40),
    dualg18c: weapon('Dual G18C', 'pistol', '9mm', 34),
    dualp30l: weapon('Dual P30L', 'pistol', '9mm', 30),
    dualot38: weapon('Dual OT-38', 'revolver', '762', 10),
    dualots38: weapon('Dual OTs-38', 'revolver', '762', 10),
    dualpeacemaker: weapon('Dual Peacemaker', 'revolver', '45acp', 12),
    dualm1911: weapon('Dual M1911', 'pistol', '45acp', 14),
    dualdeagle50: weapon('Dual DEagle 50', 'pistol', '50ae', 14),

    // Compatibility ids keep old saved/session inventory valid while all new
    // loot uses the correctly named ids above.
    pistol: weapon('M9', 'pistol', '9mm', 15),
    revolver: weapon('OT-38', 'revolver', '762', 5),
    smg: weapon('MP5', 'smg', '9mm', 30),
    shotgun: weapon('M870', 'shotgun', '12g', 5),
    assault: weapon('M416', 'assault', '556', 30),
    dmr: weapon('M39 EMR', 'dmr', '762', 20),
    sniper: weapon('Mosin-Nagant', 'sniper', '762', 5),
    lmg: weapon('M249', 'lmg', '556', 100),
    fists: weapon('Fists', 'melee', null, 0),
    knife: weapon('Combat Knife', 'melee', null, 0),
});

export const SURVIV_AMMO_CATALOG = Object.freeze({
    '9mm': { label: '9mm', color: '#f5d547', max: 180 },
    '12g': { label: '12 Gauge', color: '#f05a5a', max: 48 },
    '556': { label: '5.56mm', color: '#63d471', max: 180 },
    '762': { label: '7.62mm', color: '#5aa9f8', max: 120 },
    '45acp': { label: '.45 ACP', color: '#b6f06a', max: 120 },
    '50ae': { label: '.50 AE', color: '#6ee7f2', max: 42 },
    '308': { label: '.308 Subsonic', color: '#33434d', max: 30 },
    '40mm': { label: '40mm', color: '#d4a452', max: 12 },
    flare: { label: 'Flare', color: '#ff784f', max: 8 },
    potato: { label: 'Potato Ammo', color: '#b98a52', max: 90 },
    heart: { label: 'Heart Ammo', color: '#ef7ee8', max: 90 },
    bugle: { label: 'Bugle Ammo', color: '#f6c453', max: 30 },
});

export function getSurvivWeapon(id) {
    return SURVIV_WEAPON_CATALOG[id] || SURVIV_WEAPON_CATALOG.fists;
}

export const getSurvivWeaponLabel = id => getSurvivWeapon(id).label;
export const getSurvivWeaponFamily = id => getSurvivWeapon(id).family;
export const getSurvivWeaponAmmoType = id => getSurvivWeapon(id).ammoType;
export const getSurvivWeaponClipSize = id => getSurvivWeapon(id).clipSize;
export const getSurvivWeaponRarity = id => getSurvivWeapon(id).rarity;
