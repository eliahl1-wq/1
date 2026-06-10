import global from './global.js';

const FULL_ANGLE = 2 * Math.PI;

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    const r = food.radius || 8;
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 55%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 42%)';
    graph.lineWidth = 0;
    drawRoundObject(position, r, graph);
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
    let speed = Math.sqrt((cell.vX || 0)**2 + (cell.vY || 0)**2);

    for (let i = 0; i < pointCount; i++) {
        let theta = (i / pointCount) * FULL_ANGLE;
        // Wobble skapar den "slimiga" effekten (vibration i kanterna)
        let wobble = Math.sin(time + theta * 5) * (cell.radius * 0.02);
        // Stretch deformerar cirkeln i den riktning den rör sig (vX/vY kommer från servern)
        let stretch = Math.cos(theta - moveAngle) * (speed * 0.7);
        
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

function drawGlassPill(graph, x, y, w, h, r, { fill, stroke, lineWidth = 1 }) {
    graph.beginPath();
    graph.roundRect(x, y, w, h, r);
    graph.fillStyle = fill;
    graph.fill();
    if (stroke) {
        graph.strokeStyle = stroke;
        graph.lineWidth = lineWidth;
        graph.stroke();
    }
}

function drawBalanceBadge(graph, cell, nameY, fontSize) {
    const amount = (cell.balance || 0).toFixed(2);
    const amountFontSize = Math.max(fontSize * 0.62, 11);
    const unitFontSize = Math.max(amountFontSize * 0.72, 9);
    const gap = 2;

    graph.font = `800 ${amountFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const amountW = graph.measureText(amount).width;
    graph.font = `600 ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
    const unitW = graph.measureText('$').width;

    const padX = 10;
    const pillW = unitW + gap + amountW + padX * 2;
    const pillH = amountFontSize + 10;
    const pillX = cell.x - pillW / 2;
    const pillY = nameY + fontSize / 1.35;

    const accent = cell.isMe ? 'rgba(20, 241, 149, 0.35)' : 'rgba(255, 255, 255, 0.12)';
    drawGlassPill(graph, pillX, pillY, pillW, pillH, pillH / 2, {
        fill: cell.isMe ? 'rgba(6, 12, 10, 0.82)' : 'rgba(8, 9, 13, 0.78)',
        stroke: accent,
        lineWidth: cell.isMe ? 1.25 : 1,
    });

    const midY = pillY + pillH / 2 + 1;
    graph.textAlign = 'left';
    graph.textBaseline = 'middle';
    graph.font = `600 ${unitFontSize}px ui-monospace, SFMono-Regular, monospace`;
    graph.fillStyle = cell.isMe ? 'rgba(20, 241, 149, 0.55)' : 'rgba(255,255,255,0.35)';
    graph.fillText('$', pillX + padX, midY);

    graph.font = `800 ${amountFontSize}px ui-monospace, SFMono-Regular, monospace`;
    graph.fillStyle = cell.isMe ? '#14F195' : 'rgba(255,255,255,0.92)';
    graph.fillText(amount, pillX + padX + unitW + gap, midY);
    graph.textAlign = 'center';
}

function drawCashoutOverlay(graph, cell) {
    const total = global.cashOutTotal || 20;
    const remaining = Math.max(0, global.cashOutTimer);
    const progress = remaining / total;
    const pulse = 0.7 + Math.sin(Date.now() * 0.009) * 0.3;

    // Progress ring around blob
    const ringR = cell.radius + 10;
    graph.lineCap = 'round';
    graph.beginPath();
    graph.arc(cell.x, cell.y, ringR, 0, FULL_ANGLE);
    graph.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    graph.lineWidth = 5;
    graph.stroke();

    if (progress > 0) {
        const start = -Math.PI / 2;
        const end = start + progress * FULL_ANGLE;
        graph.beginPath();
        graph.arc(cell.x, cell.y, ringR, start, end);
        const grad = graph.createLinearGradient(cell.x - ringR, cell.y, cell.x + ringR, cell.y);
        grad.addColorStop(0, '#0DBF76');
        grad.addColorStop(1, '#14F195');
        graph.strokeStyle = grad;
        graph.lineWidth = 5;
        graph.globalAlpha = pulse;
        graph.stroke();
        graph.globalAlpha = 1;
    }

    // Floating pill above blob
    const label = 'SECURING';
    const timerText = `${remaining}s`;
    const labelSize = 9;
    const timerSize = 15;
    graph.font = `700 ${labelSize}px system-ui, sans-serif`;
    const labelW = graph.measureText(label).width;
    graph.font = `900 ${timerSize}px ui-monospace, monospace`;
    const timerW = graph.measureText(timerText).width;
    const pillW = Math.max(labelW, timerW) + 28;
    const pillH = labelSize + timerSize + 16;
    const pillX = cell.x - pillW / 2;
    const pillY = cell.y - cell.radius - pillH - 22;

    drawGlassPill(graph, pillX, pillY, pillW, pillH, 12, {
        fill: 'rgba(6, 10, 8, 0.92)',
        stroke: `rgba(20, 241, 149, ${0.35 + pulse * 0.25})`,
        lineWidth: 1.5,
    });

    // Progress bar inside pill
    const barPad = 10;
    const barY = pillY + pillH - 9;
    const barW = pillW - barPad * 2;
    graph.fillStyle = 'rgba(255,255,255,0.08)';
    graph.beginPath();
    graph.roundRect(pillX + barPad, barY, barW, 3, 2);
    graph.fill();
    if (progress > 0) {
        graph.fillStyle = '#14F195';
        graph.beginPath();
        graph.roundRect(pillX + barPad, barY, barW * progress, 3, 2);
        graph.fill();
    }

    graph.textAlign = 'center';
    graph.textBaseline = 'middle';
    graph.font = `700 ${labelSize}px system-ui, sans-serif`;
    graph.fillStyle = 'rgba(255,255,255,0.45)';
    graph.fillText(label, cell.x, pillY + 12);

    graph.font = `900 ${timerSize}px ui-monospace, monospace`;
    graph.fillStyle = '#ffffff';
    graph.fillText(timerText, cell.x, pillY + pillH * 0.52);
}

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        graph.fillStyle = cell.color;
        graph.strokeStyle = cell.borderColor;
        graph.lineWidth = 6;
        
        // High-stakes glow effect
        if (cell.isCashingOut) {
            const pulse = 0.6 + Math.sin(Date.now() * 0.012) * 0.4;
            graph.shadowBlur = 30 * pulse;
            graph.shadowColor = '#14F195';
        } else if (cell.balance > 50) {
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

        if (cell.radius >= 22) {
            drawBalanceBadge(graph, cell, nameY, fontSize);
        }

        if (cell.isMe && global.cashOutTimer > 0) {
            graph.shadowBlur = 0;
            drawCashoutOverlay(graph, cell);
        }
    }
};

const drawHUD = (global, graph) => {
    // HUD-bannern borttagen enligt önskemål. 
    // Timern visas nu istället på knappen i Game.jsx
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor; // Använd global.lineColor
    graph.globalAlpha = 0.08; // Väldigt svagt rutnät för proffsig känsla
    graph.beginPath();

    for (let x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (let y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
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