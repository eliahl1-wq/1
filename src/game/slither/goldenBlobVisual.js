const FULL = Math.PI * 2;

/** Radius occupied by the soft light around the solid pearl. */
export const GOLDEN_BLOB_HALO_SCALE = 2.75;

/**
 * Original Arenifi golden-blob artwork. The collectible reads primarily as a
 * polished white pearl; restrained champagne tones keep its premium/golden
 * identity without turning the whole pickup saturated yellow.
 */
export function drawGoldenBlob(ctx, x, y, radius) {
    const r = Math.max(1, radius);
    const haloR = r * GOLDEN_BLOB_HALO_SCALE;

    // Wide, low-opacity bloom. This remains visible over both light and dark
    // terrain without creating the old flat yellow fog.
    const bloom = ctx.createRadialGradient(x, y, r * 0.18, x, y, haloR);
    bloom.addColorStop(0, 'rgba(255, 255, 250, 0.34)');
    bloom.addColorStop(0.30, 'rgba(255, 253, 237, 0.22)');
    bloom.addColorStop(0.58, 'rgba(255, 244, 205, 0.095)');
    bloom.addColorStop(0.82, 'rgba(255, 238, 180, 0.025)');
    bloom.addColorStop(1, 'rgba(255, 238, 180, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, FULL);
    ctx.fill();

    // A faint lower contact shade gives the small orb a physical silhouette.
    const shade = ctx.createRadialGradient(
        x + r * 0.12, y + r * 0.28, r * 0.12,
        x + r * 0.12, y + r * 0.28, r * 1.18,
    );
    shade.addColorStop(0, 'rgba(129, 98, 43, 0.22)');
    shade.addColorStop(0.72, 'rgba(129, 98, 43, 0.07)');
    shade.addColorStop(1, 'rgba(129, 98, 43, 0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.20, r * 1.10, r * 0.92, 0, 0, FULL);
    ctx.fill();

    // Offset lighting produces a glossy pearl rather than a glowing disc.
    const pearl = ctx.createRadialGradient(
        x - r * 0.34, y - r * 0.40, r * 0.04,
        x + r * 0.06, y + r * 0.10, r * 1.16,
    );
    pearl.addColorStop(0, '#ffffff');
    pearl.addColorStop(0.26, '#fffef9');
    pearl.addColorStop(0.53, '#fffbed');
    pearl.addColorStop(0.76, '#f4e9c5');
    pearl.addColorStop(0.92, '#d8c37e');
    pearl.addColorStop(1, '#9c8248');
    ctx.fillStyle = pearl;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, FULL);
    ctx.fill();

    // Cool reflected light keeps the dominant read white instead of yellow.
    const reflection = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    reflection.addColorStop(0, 'rgba(225, 246, 255, 0.24)');
    reflection.addColorStop(0.48, 'rgba(255, 255, 255, 0)');
    reflection.addColorStop(0.78, 'rgba(255, 245, 211, 0.11)');
    reflection.addColorStop(1, 'rgba(181, 143, 67, 0.20)');
    ctx.fillStyle = reflection;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.94, 0, FULL);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 246, 0.88)';
    ctx.lineWidth = Math.max(0.55, r * 0.105);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.94, 0, FULL);
    ctx.stroke();

    // Two compact specular marks stay readable after sprite downscaling.
    ctx.save();
    ctx.translate(x - r * 0.32, y - r * 0.36);
    ctx.rotate(-0.55);
    ctx.scale(1, 0.62);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.27, 0, FULL);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
    ctx.beginPath();
    ctx.arc(x + r * 0.34, y + r * 0.26, r * 0.105, 0, FULL);
    ctx.fill();

    // A tiny four-point gleam gives it a premium collectible read without
    // adding particles or per-frame allocations.
    const gx = x + r * 0.67;
    const gy = y - r * 0.54;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
    ctx.lineWidth = Math.max(0.5, r * 0.075);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx - r * 0.25, gy);
    ctx.lineTo(gx + r * 0.25, gy);
    ctx.moveTo(gx, gy - r * 0.25);
    ctx.lineTo(gx, gy + r * 0.25);
    ctx.stroke();
}
