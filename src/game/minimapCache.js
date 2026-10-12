import { drawGameMinimap } from './minimap.js';

// Radar updates need far fewer redraws than the world. Cache the small surface
// at the real backing scale, then composite it into each game frame.
export class GameMinimapCache {
    constructor({ createCanvas = () => document.createElement('canvas'), draw = drawGameMinimap } = {}) {
        this.createCanvas = createCanvas;
        this.drawRadar = draw;
        this.nextAt = 0;
        this.key = '';
    }
    draw(ctx, options) {
        const isMobile = !!options.isMobile;
        const size = isMobile ? 92 : 160;
        const dpr = Math.min(2, Math.max(0.5, ctx.getTransform?.().a || 1));
        const now = options.time ?? performance.now();
        const key = `${size}:${dpr}:${options.screenW}:${options.screenH}`;
        if (!this.canvas) { this.canvas = this.createCanvas(); this.context = this.canvas.getContext('2d'); }
        if (key !== this.key) {
            const pixels = Math.ceil(size * dpr);
            if (this.canvas.width !== pixels) this.canvas.width = pixels;
            if (this.canvas.height !== pixels) this.canvas.height = pixels;
            this.key = key;
            this.nextAt = 0;
        }
        if (now >= this.nextAt) {
            this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.context.clearRect(0, 0, size, size);
            this.drawRadar(this.context, { ...options, screenW: size, screenH: size, time: now });
            this.nextAt = now + 1000 / 12;
        }
        ctx.drawImage(this.canvas, 0, 0, size, size);
    }
}
