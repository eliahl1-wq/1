// Developer-only, real server simulation + real renderer. No sockets, accounts,
// entry fees or production calls. Open /surviv-playtest.html with `npm run dev`.
import { SurvivRenderer } from '../src/game/surviv/SurvivRenderer.js';
import { applySurvivFireInput, broadcastSurvivState, createSurvivPlayer,
    equipSurvivWeaponSlot, generateSurvivMap, processSurvivRoom,
    spawnSurvivAirdrop, toggleSurvivDoor, beginSurvivReload } from '../../phantom-game-server/surviv-engine.js';

if (!import.meta.env.DEV) throw new Error('Local playtest requires the development server.');
const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const renderer = new SurvivRenderer(canvas);
let room, me, scene = 'yard', blastX = 0, blastY = 0, latestTick;
const io = { to: id => ({ emit(type, data) {
    if (id === me?.id && type === 'survivTick') {
        latestTick = data;
        renderer.updateState(structuredClone(data));
    }
} }) };
const prop = (id, kind, x, y, w, h, extra = {}) => ({ id, kind, x, y, w, h, collidable: true, ...extra });
function reset(next) {
    scene = next;
    renderer.resetSession();
    room = { id: 'local-playtest', entryFeeUsd: 5, players: [], bots: [], bullets: [],
        loot: [], obstacles: [], spawnPoints: [], landmarks: [], spectators: [],
        _nextSurvivBotSyncAt: Infinity, _nextSurvivAirdropAt: Infinity };
    blastX = 0; blastY = 0;
    if (scene === 'glasshouse') {
        const map = generateSurvivMap(10000);
        Object.assign(room, map);
        const landmark = map.landmarks.find(item => item.type === 'glasshouse');
        blastX = landmark?.x ?? -3500;
        blastY = landmark?.y ?? 900;
    } else {
        room.obstacles = [
            prop('pad', 'field', 0, 0, 540, 330, { collidable: false, variant: 'gravel' }),
            ...[0, 65, 130].map((x, i) => prop(`fuel-${i}`, 'barrel', x, 0, 36, 36, { variant: 'fuel', hp: 42, maxHp: 42 })),
            prop('water', 'barrel', -130, 0, 36, 36, { variant: 'water', hp: 42, maxHp: 42 }),
            prop('cover', 'crate', -40, -95, 52, 52, { variant: 'industrial', hp: 65, maxHp: 65 }),
            prop('stone', 'rock', -260, 100, 64, 60, { hp: 100, maxHp: 100 }),
            prop('tree', 'tree', 270, -140, 135, 130, { hue: 108, canopyStyle: 'surviv', hp: 120, maxHp: 120 }),
        ];
    }
    me = createSurvivPlayer('local-player', 'local', 'Playtester', '#b77bed', room);
    Object.assign(me, { x: blastX - 80, y: blastY + 160, dollarBalance: 0 });
    me.inventory.weapons = ['assault'];
    me.weaponSlotAmmo = [30];
    equipSurvivWeaponSlot(me, 0);
    room.players.push(me);
    renderer.setMyId(me.id);
    renderer.setInputEnabled(true);
    if (scene === 'drop') {
        // Reproducible nearby landing while still running normal descent/landing.
        const drop = spawnSurvivAirdrop(room, Date.now(), { x: 0, y: 0, radius: 4000 });
        if (drop) { drop.x = 0; drop.y = 120; }
    }
    tick();
}
function tick() {
    if (!room || me.hp <= 0) return;
    const input = renderer.getInputPayload();
    Object.assign(me, { inputDx: input.dx, inputDy: input.dy, aimAngle: input.aimAngle });
    applySurvivFireInput(me, input.shooting, input.firePressId);
    const started = performance.now();
    const state = processSurvivRoom(room, io, Date.now() + 600000);
    broadcastSurvivState(room, io, state, {});
    const elapsed = performance.now() - started;
    status.textContent = `WASD move · mouse fire · F door/pickup · R reload\n${scene} · HP ${Math.ceil(me.hp)} · ammo ${me.weapon.ammo} · ${room.obstacles.length} objects\nsimulation + snapshot ${elapsed.toFixed(2)} ms · ${latestTick?.explosions.length || 0} explosion events · ${renderer.particles.length} particles`;
}
document.querySelector('#yard').onclick = () => reset('yard');
document.querySelector('#drop').onclick = () => reset('drop');
document.querySelector('#glasshouse').onclick = () => reset('glasshouse');
document.querySelector('#blast').onclick = () => {
    room.bullets.push({ id: `test-${Date.now()}`, ownerId: me.id, x: blastX, y: blastY,
        vx: 0, vy: 0, damage: 140, isGrenade: true, detonateAt: 0, bornAt: Date.now() });
};
window.addEventListener('keydown', event => {
    const action = renderer.handleKeyDown(event);
    if (action?.startsWith('toggleDoor:')) { me.toggleDoorId = action.slice('toggleDoor:'.length); toggleSurvivDoor(me, room, Date.now()); }
    if (action === 'pickupWeapon') me.pickupWeaponPending = true;
    if (event.key.toLowerCase() === 'r') beginSurvivReload(me, Date.now());
});
window.addEventListener('keyup', event => renderer.handleKeyUp(event));
canvas.addEventListener('pointermove', event => renderer.handlePointerMove(event.clientX, event.clientY));
canvas.addEventListener('pointerdown', () => renderer.handlePointerDown());
window.addEventListener('pointerup', () => renderer.handlePointerUp());
window.addEventListener('blur', () => renderer.clearInput());
reset('yard');
renderer.start();
const interval = setInterval(tick, 25);
window.addEventListener('pagehide', () => { clearInterval(interval); renderer.destroy(); });
