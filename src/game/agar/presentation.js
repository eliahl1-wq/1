// Render-only interpolation between authoritative Agar positions. No local
// collision, mass or money simulation: snapshots still own every gameplay value.
export class AgarPresentation {
    constructor() { this.players = new Map(); this.visible = []; this.lastSnapshotAt = 0; }
    reset() { this.players.clear(); this.visible.length = 0; this.lastSnapshotAt = 0; }
    update(users, now) {
        this.sample(now);
        const duration = this.lastSnapshotAt ? Math.max(16, Math.min(50, now - this.lastSnapshotAt)) : 25;
        this.lastSnapshotAt = now;
        const seen = new Set();
        this.visible.length = 0;
        for (const user of users || []) {
            seen.add(user.id);
            let entry = this.players.get(user.id);
            if (!entry) { entry = { view: {}, cells: new Map(), tracks: [] }; this.players.set(user.id, entry); }
            Object.assign(entry.view, user);
            const cells = [];
            const tracks = [];
            const seenCells = new Set();
            for (const cell of user.cells || []) {
                seenCells.add(cell.id);
                let track = entry.cells.get(cell.id);
                const snap = !track || Math.hypot(cell.x - track.view.x, cell.y - track.view.y) > Math.max(300, (cell.radius || 0) * 4);
                if (!track) { track = { view: {} }; entry.cells.set(cell.id, track); }
                track.fromX = snap ? cell.x : track.view.x;
                track.fromY = snap ? cell.y : track.view.y;
                track.fromRadius = snap ? cell.radius : track.view.radius;
                track.toX = cell.x; track.toY = cell.y; track.toRadius = cell.radius;
                track.startedAt = now; track.duration = duration;
                Object.assign(track.view, cell, { x: track.fromX, y: track.fromY, radius: track.fromRadius });
                cells.push(track.view); tracks.push(track);
            }
            for (const id of entry.cells.keys()) if (!seenCells.has(id)) entry.cells.delete(id);
            entry.view.cells = cells;
            entry.tracks = tracks;
            this.visible.push(entry.view);
        }
        for (const id of this.players.keys()) if (!seen.has(id)) this.players.delete(id);
        return this.sample(now);
    }
    sample(now) {
        for (const entry of this.players.values()) {
            let x = 0, y = 0, mass = 0;
            for (const track of entry.tracks) {
                const t = Math.max(0, Math.min(1, (now - track.startedAt) / track.duration));
                const cell = track.view;
                cell.x = track.fromX + (track.toX - track.fromX) * t;
                cell.y = track.fromY + (track.toY - track.fromY) * t;
                cell.radius = track.fromRadius + (track.toRadius - track.fromRadius) * t;
                const weight = Math.max(0.0001, Number(cell.balance) || 0);
                x += cell.x * weight; y += cell.y * weight; mass += weight;
            }
            if (mass > 0) { entry.view.x = x / mass; entry.view.y = y / mass; }
        }
        return this.visible;
    }
}
