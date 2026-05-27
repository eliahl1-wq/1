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
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth = 0;
    drawRoundObject(position, food.radius, graph);
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

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        graph.fillStyle = cell.color;
        graph.strokeStyle = cell.borderColor;
        graph.lineWidth = 6;
        
        // High-stakes glow effect
        if (cell.isCashingOut) {
            // Guld-glöd för spelare som håller på att casha ut
            graph.shadowBlur = 50;
            graph.shadowColor = '#FFD700'; 
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
        let fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        
        // Reset shadow for text to keep it crisp
        graph.shadowBlur = 0;
        
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        graph.strokeText(cell.name, cell.x, cell.y);
        graph.fillText(cell.name, cell.x, cell.y);

        // Visa Dollar-saldot (endast det som faktiskt påverkar storleken på cellen)
        let balanceFontSize = Math.max(fontSize / 3 * 2, 11);
        graph.font = 'bold ' + balanceFontSize + 'px sans-serif';
        let balanceText = '$' + (cell.balance || 0).toFixed(2);
        graph.strokeText(balanceText, cell.x, cell.y + fontSize);
        graph.fillText(balanceText, cell.x, cell.y + fontSize);

        // Visa Cashout-timer för mig själv
        if (cell.isMe && (global.cashOutTimer > 0 || cell.isCashingOut)) {
            graph.shadowBlur = 0;
            graph.fillStyle = '#FFD700'; // Guld-gul färg för utbetalning
            graph.strokeStyle = '#FFFFFF';
            graph.lineWidth = 3;
            
            // Mycket större och tydligare font (minst 24px)
            const timerFontSize = Math.max(fontSize * 1.2, 24);
            graph.font = 'bold ' + timerFontSize + 'px sans-serif';
            
            let timeRemaining = global.cashOutTimer > 0 ? global.cashOutTimer : 30;
            let timerText = `EXITING: ${timeRemaining}s`;
            
            // Rita den OVANFÖR cellen så den syns tydligt oavsett storlek
            graph.strokeText(timerText, cell.x, cell.y - cell.radius - 30);
            graph.fillText(timerText, cell.x, cell.y - cell.radius - 30);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = '#ffffff';
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

export { drawFood, drawVirus, drawFireFood, drawCells, drawErrorMessage, drawGrid, drawBorder, drawOrganicCell };