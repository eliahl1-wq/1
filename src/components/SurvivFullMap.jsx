import React, { useEffect, useRef } from 'react';

const MAP_COLORS = {
    road: '#77766c',
    roadJunction: '#77766c',
    trail_path: '#a08d67',
    river_path: '#4d91aa',
    water: '#4d91aa',
    bridge: '#8e7658',
    houseFloor: '#b9a77f',
    wall: '#554b3d',
    interiorWall: '#625746',
    container: '#6f7776',
};

function drawObstacle(ctx, obstacle, toMap, scale) {
    if (!obstacle || obstacle.x == null || obstacle.y == null) return;
    const color = MAP_COLORS[obstacle.kind];
    if (!color) return;
    const point = toMap(obstacle.x, obstacle.y);

    if ((obstacle.kind === 'trail_path' || obstacle.kind === 'river_path') && obstacle.points?.length > 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = obstacle.kind === 'river_path' ? 0.9 : 0.72;
        ctx.lineWidth = Math.max(1, (obstacle.width || (obstacle.kind === 'river_path' ? 220 : 54)) * scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        obstacle.points.forEach((pathPoint, index) => {
            const p = toMap(pathPoint.x, pathPoint.y);
            if (index === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
        return;
    }

    const width = Math.max(1, (obstacle.w || obstacle.width || 12) * scale);
    const height = Math.max(1, (obstacle.h || obstacle.height || obstacle.w || 12) * scale);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(obstacle.rotation || 0);
    ctx.fillStyle = color;
    ctx.globalAlpha = obstacle.kind === 'road' || obstacle.kind === 'roadJunction' ? 0.66 : 0.92;
    if (obstacle.kind === 'water') {
        ctx.beginPath();
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillRect(-width / 2, -height / 2, width, height);
    }
    ctx.restore();
}

export default function SurvivFullMap({ map, activityZones = [], player, zone, onClose }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            const cssSize = Math.max(240, Math.floor(Math.min(rect.width, rect.height)));
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            if (canvas.width !== Math.round(cssSize * dpr) || canvas.height !== Math.round(cssSize * dpr)) {
                canvas.width = Math.round(cssSize * dpr);
                canvas.height = Math.round(cssSize * dpr);
            }
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, cssSize, cssSize);

            const padding = 14;
            const innerSize = cssSize - padding * 2;
            const worldHalf = Math.max(1, Number(map?.worldHalf) || 10000);
            const scale = innerSize / (worldHalf * 2);
            const toMap = (x, y) => ({
                x: padding + (x + worldHalf) * scale,
                y: padding + (y + worldHalf) * scale,
            });

            ctx.fillStyle = '#78955e';
            ctx.fillRect(padding, padding, innerSize, innerSize);

            ctx.save();
            ctx.beginPath();
            ctx.rect(padding, padding, innerSize, innerSize);
            ctx.clip();

            for (const obstacle of map?.obstacles || []) drawObstacle(ctx, obstacle, toMap, scale);

            if (zone?.radius > 0) {
                const center = toMap(zone.x ?? zone.cx ?? 0, zone.y ?? zone.cy ?? 0);
                ctx.beginPath();
                ctx.arc(center.x, center.y, zone.radius * scale, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(220, 55, 48, 0.92)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            for (const activity of activityZones) {
                const center = toMap(activity.x, activity.y);
                const radius = Math.max(18, activity.radius * scale);
                const gradient = ctx.createRadialGradient(center.x, center.y, radius * 0.12, center.x, center.y, radius);
                const alpha = Math.min(0.34, 0.16 + (activity.strength || 0.5) * 0.16);
                gradient.addColorStop(0, `rgba(205, 42, 36, ${alpha})`);
                gradient.addColorStop(0.68, `rgba(205, 42, 36, ${alpha * 0.62})`);
                gradient.addColorStop(1, 'rgba(205, 42, 36, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `rgba(187, 35, 31, ${Math.min(0.68, alpha + 0.24)})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            const acceptedLabels = [];
            ctx.font = '700 9px "Space Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const landmark of map?.landmarks || []) {
                if (!landmark.name || landmark.x == null || landmark.y == null) continue;
                const p = toMap(landmark.x, landmark.y);
                if (acceptedLabels.some(label => Math.hypot(label.x - p.x, label.y - p.y) < 58)) continue;
                acceptedLabels.push(p);
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(42, 48, 35, 0.75)';
                ctx.strokeText(landmark.name.toUpperCase(), p.x, p.y);
                ctx.fillStyle = 'rgba(246, 242, 216, 0.9)';
                ctx.fillText(landmark.name.toUpperCase(), p.x, p.y);
            }

            if (player?.x != null && player?.y != null) {
                const me = toMap(player.x, player.y);
                ctx.fillStyle = '#fffdf0';
                ctx.strokeStyle = 'rgba(32, 35, 28, 0.95)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(me.x, me.y, 5.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();

            ctx.strokeStyle = 'rgba(237, 231, 202, 0.72)';
            ctx.lineWidth = 2;
            ctx.strokeRect(padding, padding, innerSize, innerSize);
        };

        draw();
        const observer = new ResizeObserver(draw);
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [map, activityZones, player?.x, player?.y, zone?.x, zone?.y, zone?.cx, zone?.cy, zone?.radius]);

    return (
        <div className="surviv-full-map-overlay" role="dialog" aria-modal="true" aria-label="Full match map">
            <div className="surviv-full-map-shell">
                <div className="surviv-full-map-heading">
                    <strong>ISLAND MAP</strong>
                    <span><i aria-hidden="true" /> ACTIVITY AREA</span>
                    <button type="button" onClick={onClose} aria-label="Close map">×</button>
                </div>
                <canvas ref={canvasRef} className="surviv-full-map-canvas" />
                <div className="surviv-full-map-help">HOLD TAB · M TOGGLE · G DROP HELD</div>
            </div>
        </div>
    );
}
