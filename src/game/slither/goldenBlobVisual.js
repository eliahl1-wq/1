const FULL = Math.PI * 2;

/** Radius occupied by the fully feathered light around the translucent core. */
export const GOLDEN_BLOB_HALO_SCALE = 3.1;

/**
 * Original Arenifi golden-blob artwork. Every layer fades to transparent before
 * its geometry ends, so the collectible has no visible circle or outline.
 */
export function drawGoldenBlob(ctx, x, y, radius) {
    const r = Math.max(1, radius);
    const haloR = r * GOLDEN_BLOB_HALO_SCALE;

    // Broad champagne bloom, deliberately weak at the perimeter.
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    bloom.addColorStop(0, 'rgba(255, 236, 164, 0.34)');
    bloom.addColorStop(0.22, 'rgba(255, 218, 106, 0.25)');
    bloom.addColorStop(0.48, 'rgba(255, 194, 55, 0.125)');
    bloom.addColorStop(0.72, 'rgba(255, 181, 35, 0.045)');
    bloom.addColorStop(0.90, 'rgba(255, 174, 30, 0.010)');
    bloom.addColorStop(1, 'rgba(255, 174, 30, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, FULL);
    ctx.fill();

    // The core is itself a glow—not an opaque ball. Its last visible colour is
    // well inside the drawn radius, which avoids a hard antialiased edge.
    const coreR = r * 1.58;
    const core = ctx.createRadialGradient(
        x - r * 0.10, y - r * 0.12, 0,
        x, y, coreR,
    );
    core.addColorStop(0, 'rgba(255, 249, 211, 0.76)');
    core.addColorStop(0.16, 'rgba(255, 239, 172, 0.69)');
    core.addColorStop(0.38, 'rgba(255, 224, 128, 0.59)');
    core.addColorStop(0.62, 'rgba(255, 199, 69, 0.33)');
    core.addColorStop(0.80, 'rgba(255, 181, 38, 0.12)');
    core.addColorStop(0.93, 'rgba(255, 173, 28, 0.025)');
    core.addColorStop(1, 'rgba(255, 170, 25, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, coreR, 0, FULL);
    ctx.fill();

    // Diffuse off-centre sheen adds depth but has no isolated white spot,
    // sparkle lines or rim that could read as an outline at small scale.
    const sheen = ctx.createRadialGradient(
        x - r * 0.34, y - r * 0.38, 0,
        x - r * 0.22, y - r * 0.28, r * 0.92,
    );
    sheen.addColorStop(0, 'rgba(255, 255, 235, 0.30)');
    sheen.addColorStop(0.28, 'rgba(255, 249, 211, 0.20)');
    sheen.addColorStop(0.62, 'rgba(255, 242, 187, 0.10)');
    sheen.addColorStop(1, 'rgba(255, 236, 166, 0)');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.28, r * 0.92, 0, FULL);
    ctx.fill();
}
