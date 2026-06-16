import global from './global.js';
import { drawCashoutProgressRing, getCashoutRingProgress } from '../cashoutRing.js';
import { drawBalanceBadge as drawBalanceBadgePill } from '../balanceBadge.js';

const FULL_ANGLE = 2 * Math.PI;

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    const r = food.radius || 5;
    const sx = Math.round(position.x);
    const sy = Math.round(position.y);
    if (food.golden) {
        graph.fillStyle = 'hsl(48, 100%, 62%)';
        graph.strokeStyle = 'hsl(45, 100%, 45%)';
        graph.lineWidth = 2;
        graph.beginPath();
        graph.arc(sx, sy, r + 4, 0, FULL_ANGLE);
        graph.fill();
        graph.stroke();
        graph.fillStyle = 'hsl(52, 100%, 78%)';
        graph.beginPath();
        graph.arc(sx, sy, r * 0.55, 0, FULL_ANGLE);
        graph.fill();
        return;
    }
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 55%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 42%)';
    graph.lineWidth = 0;
    drawRoundObject({ x: sx, y: sy }, r, graph);
};

const drawVirus = (position, virus, graph) => {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    let sides = 40; // Fler sidor för taggigare virus

    graph.beginPath();
    for (let i = 0; i < sides; i++) {
        let theta = (i / sides) * FULL_ANGLE;
        let r = (i % 2 === 0) ? virus.radius : virus.radius * 1.08;
        let point = circlePoint(position, r, theta);
        graph.lineTo(point.x, point.y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value))

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta)
});

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y)
});

function drawOrganicCell(cell, borders, graph) {
    // Dynamiskt antal punkter baserat på storlek för prestanda/utseende
    let pointCount = Math.min(Math.max(~~(cell.radius), 24), 60);
    let points = [];
    let time = Date.now() * 0.002;
    let moveAngle = Math.atan2(cell.vY || 0, cell.vX || 0);
    let speed = Math.min(Math.sqrt((cell.vX || 0) ** 2 + (cell.vY || 0) ** 2), 6);

    for (let i = 0; i < pointCount; i++) {
        let theta = (i / pointCount) * FULL_ANGLE;
        // Wobble skapar den "slimiga" effekten (vibration i kanterna)
        let wobble = Math.sin(time + theta * 5) * (cell.radius * 0.02);
        // Stretch deformerar cirkeln i den riktning den rör sig (dämpad för mindre motion blur)
        let stretch = Math.cos(theta - moveAngle) * (speed * 0.35);
        
        let point = circlePoint(cell, cell.radius + wobble + stretch, theta);
        points.push(regulatePoint(point, borders));
    }
    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        graph.lineTo(points[i].x, points[i].y);
    }
    graph.closePath();
    graph.fill();
    graph.stroke();
}


function drawBalanceBadge(graph, cell, nameY, fontSize) {
    const pillY = nameY + fontSize / 1.35;
    drawBalanceBadgePill(graph, cell.x, pillY, cell.balance, cell.isMe);
}

function drawPlayerCashoutRing(graph, cell) {
    const total = global.cashOutTotal || 10;
    const progress = global.cashOutEndAt
        ? getCashoutRingProgress(global.cashOutEndAt, total)
        : Math.max(0, global.cashOutTimer) / total;
    const ringR = cell.radius + 10;
    drawCashoutProgressRing(graph, cell.x, cell.y, ringR, progress);
}

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        graph.fillStyle = cell.color;
        graph.strokeStyle = cell.borderColor;
        graph.lineWidth = 6;
        
        // High-stakes glow effect
        if (!global.battleRoyale && cell.balance > 50) {
            graph.shadowBlur = 40; // Starkare glöd
            graph.shadowColor = '#FFD700'; // Guld-färg
        } else {
            graph.shadowBlur = 15;
            graph.shadowColor = cell.color;
        }
        
        // Använd den organiska ritningen för slimy-effekt
        drawOrganicCell(cell, borders, graph);

        // Draw the name of the player
        // Dynamisk fontstorlek: aggressivare skalning för korta namn (som 'eli')
        let fontSize = cell.radius / 1.8;
        let lengthMultiplier = 1;
        if (cell.name.length > 3) lengthMultiplier = 0.7;
        if (cell.name.length > 7) lengthMultiplier = 0.5;
        if (cell.name.length > 12) lengthMultiplier = 0.35;
        fontSize = Math.max(fontSize * lengthMultiplier, 14);
        
        graph.lineWidth = playerConfig.textBorderSize;
        graph.shadowBlur = 0;
        
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        
        const nameY = cell.y - (cell.radius * 0.1);
        graph.strokeText(cell.name, cell.x, nameY);
        graph.fillText(cell.name, cell.x, nameY);

        if (!global.battleRoyale && cell.radius >= 22) {
            drawBalanceBadge(graph, cell, nameY, fontSize);
        }

        if (cell.isMe && global.holdCashoutProgress > 0 && global.cashOutTimer <= 0 && !global.battleRoyale) {
            graph.shadowBlur = 0;
            const ringR = cell.radius + 10;
            drawCashoutProgressRing(graph, cell.x, cell.y, ringR, global.holdCashoutProgress, { counterClockwise: true });
        }

        if (cell.isMe && global.cashOutTimer > 0) {
            graph.shadowBlur = 0;
            drawPlayerCashoutRing(graph, cell);
        }
    }
};

const drawHUD = (global, graph) => {
    // HUD-bannern borttagen enligt önskemål. 
    // Timern visas nu istället på knappen i Game.jsx
};

const drawGrid = (global, player, screen, graph, viewZoom = 1) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.08;
    graph.beginPath();

    const step = screen.height / 18 / viewZoom;
    const halfW = screen.width / (2 * viewZoom);
    const halfH = screen.height / (2 * viewZoom);
    const startX = Math.floor((player.x - halfW) / step) * step;
    const endX = player.x + halfW;
    const startY = Math.floor((player.y - halfH) / step) * step;
    const endY = player.y + halfH;

    for (let gx = startX; gx <= endX; gx += step) {
        const sx = (gx - player.x) * viewZoom + screen.width / 2;
        graph.moveTo(sx, 0);
        graph.lineTo(sx, screen.height);
    }

    for (let gy = startY; gy <= endY; gy += step) {
        const sy = (gy - player.y) * viewZoom + screen.height / 2;
        graph.moveTo(0, sy);
        graph.lineTo(screen.width, sy);
    }

    graph.stroke();
    graph.globalAlpha = 1;
};

const drawBorder = (borders, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = '#000000'
    graph.beginPath()
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath()
    graph.stroke();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
}

export { drawFood, drawVirus, drawFireFood, drawCells, drawErrorMessage, drawGrid, drawBorder, drawOrganicCell, drawHUD };