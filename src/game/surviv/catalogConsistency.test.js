import test from 'node:test';
import assert from 'node:assert/strict';
import { SURVIV_AMMO_CATALOG, SURVIV_WEAPON_CATALOG } from './weaponCatalog.js';
import { SURVIV_AMMO, WEAPONS } from '../../../../phantom-game-server/surviv-engine.js';
import { SURVIV_STANDARD_FIREARM_IDS } from '../../../../phantom-game-server/surviv-weapons.js';

test('standard loadout magazine sizes and ammo pickup capacities match server authority',()=>{
    for(const id of SURVIV_STANDARD_FIREARM_IDS) {
        assert.equal(SURVIV_WEAPON_CATALOG[id].clipSize,WEAPONS[id].clipSize,id);
        assert.equal(SURVIV_WEAPON_CATALOG[id].ammoType,WEAPONS[id].ammoType,id);
        const ammo=WEAPONS[id].ammoType;
        assert.equal(SURVIV_AMMO_CATALOG[ammo].max,SURVIV_AMMO[ammo].max,ammo);
    }
});
