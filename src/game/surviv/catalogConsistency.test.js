import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurvivWeaponRarity, SURVIV_AMMO_CATALOG, SURVIV_WEAPON_CATALOG } from './weaponCatalog.js';
import { SURVIV_AMMO, WEAPONS } from '../../../../phantom-game-server/surviv-engine.js';
import { SURVIV_STANDARD_FIREARM_IDS } from '../../../../phantom-game-server/surviv-weapons.js';
import { survivTierEconomy } from '../../constants/economy.js';

test('standard loadout magazine sizes and ammo pickup capacities match server authority',()=>{
    for(const id of SURVIV_STANDARD_FIREARM_IDS) {
        assert.equal(SURVIV_WEAPON_CATALOG[id].clipSize,WEAPONS[id].clipSize,id);
        assert.equal(SURVIV_WEAPON_CATALOG[id].ammoType,WEAPONS[id].ammoType,id);
        assert.equal(getSurvivWeaponRarity(id), WEAPONS[id].rarity, id);
        const ammo=WEAPONS[id].ammoType;
        assert.equal(SURVIV_AMMO_CATALOG[ammo].max,SURVIV_AMMO[ammo].max,ammo);
    }
});

test('pregame explains the actual normal and practice allocation, not the old zero-dollar start',()=>{
    const paid=survivTierEconomy(5),practice=survivTierEconomy(5,{freePlay:true});
    assert.equal(paid.dollarStart,1);assert.equal(paid.botStart,1);
    assert.equal(paid.lootPoolOnJoin,3);assert.equal(paid.maxLootPoolOnJoin,4);
    assert.equal(practice.lootPoolOnJoin,18);assert.equal(practice.maxLootPoolOnJoin,19);
});
