const Nball_Assets = 13;
globalThis.snake = class snake {
    constructor(name, game, score, x, y) {
        this.name = name;
        this.game = game;
        this.score = score;
        this.x = x;
        this.y = y;
        this.init();
    }

    init() {
        this.time = Math.floor(20 + Math.random() * 100);
        this.speed = 1;
        this.size = this.game.getSize() * 1;
        this.angle = 0;
        this.dx = Math.random() * MaxSpeed - Math.random() * MaxSpeed;
        this.dy = Math.random() * MaxSpeed - Math.random() * MaxSpeed;

        this.v = [];
        for (let i = 0; i < 50; i++)
            this.v[i] = { x: this.x, y: this.y };

        this.path = this.v.map(p => ({ x: p.x, y: p.y }));

        this.sn_im = new Image();
        this.sn_im.src = "/images/head.png";
        this.bd_im = new Image();
        this.bd_im.src = "/images/body/" + Math.floor(Math.random() * 999999) % Nball_Assets + ".png";
    }

    update() {
        this.time--;
        this.angle = this.getAngle(this.dx, this.dy);
        
        // Endast AI-ormar uppdaterar sin riktning och poäng automatiskt här
        if (window.mySnake && this !== window.mySnake[0]) {
            if (this.time > 90)
                this.speed = 2;
            else
                this.speed = 1;
            if (this.time <= 0) {
                this.time = Math.floor(10 + Math.random() * 20);
                this.dx = Math.random() * MaxSpeed - Math.random() * MaxSpeed;
                this.dy = Math.random() * MaxSpeed - Math.random() * MaxSpeed;

                let minRange = Math.sqrt(game_W * game_W + game_H * game_H);

                for (let i = 0; i < FOOD.length; i++) {
                    if (FOOD[i].size > this.game.getSize() / 10 && this.range(this.v[0], FOOD[i]) < minRange) {
                        minRange = this.range(this.v[0], FOOD[i]);
                        this.dx = FOOD[i].x - this.v[0].x;
                        this.dy = FOOD[i].y - this.v[0].y;
                    }
                }
                if (minRange < Math.sqrt(game_W * game_W + game_H * game_H))
                    this.time = 0;
                // console.log(minRange);

                while (Math.abs(this.dy) * Math.abs(this.dy) + Math.abs(this.dx) * Math.abs(this.dx) > MaxSpeed * MaxSpeed && this.dx * this.dy != 0) {
                    this.dx /= 1.1;
                    this.dy /= 1.1;
                }
                while (Math.abs(this.dy) * Math.abs(this.dy) + Math.abs(this.dx) * Math.abs(this.dx) < MaxSpeed * MaxSpeed && this.dx * this.dy != 0) {
                    this.dx *= 1.1;
                    this.dy *= 1.1;
                }
            }
            this.score += this.score / 666;
        }

        // Alla ormar (inklusive spelaren) uppdaterar sin huvudposition här
        // Vi använder globalThis.SPEED för att kontrollera den allmänna hastigheten mjukt
        this.v[0].x += this.dx * this.speed * (globalThis.SPEED || 1);
        this.v[0].y += this.dy * this.speed * (globalThis.SPEED || 1);

        const spacing = this.size / 10;
        const head = this.v[0];
        const path = this.path;

        if (this.range(path[0], head) > 0.01) {
            path.unshift({ x: head.x, y: head.y });
        } else {
            path[0].x = head.x;
            path[0].y = head.y;
        }

        for (let segIdx = 1; segIdx < this.v.length; segIdx++) {
            const targetDist = segIdx * spacing;
            let walked = 0;
            let placed = false;

            for (let i = 0; i < path.length - 1; i++) {
                const ax = path[i].x;
                const ay = path[i].y;
                const bx = path[i + 1].x;
                const by = path[i + 1].y;
                const edgeLen = this.range(path[i], path[i + 1]);

                if (walked + edgeLen >= targetDist) {
                    const t = edgeLen > 1e-6 ? (targetDist - walked) / edgeLen : 0;
                    this.v[segIdx].x = ax + (bx - ax) * t;
                    this.v[segIdx].y = ay + (by - ay) * t;
                    placed = true;
                    break;
                }
                walked += edgeLen;
            }

            if (!placed) {
                const tail = path[path.length - 1];
                this.v[segIdx].x = tail.x;
                this.v[segIdx].y = tail.y;
            }
        }

        let arc = 0;
        for (let i = 0; i < path.length - 1; i++) {
            arc += this.range(path[i], path[i + 1]);
        }
        const maxArc = this.v.length * spacing + spacing * 4;
        while (path.length > 2 && arc > maxArc) {
            const last = path.pop();
            arc -= this.range(path[path.length - 1], last);
        }

        if (this.speed == 2) {
            this.score -= this.score / 2000;
            // Spawn real food behind tail
            if (Math.random() < 0.15 && this.v.length > 0) {
                const tail = this.v[this.v.length - 1];
                const pSize = this.size * 0.45;
                const f = new window.food(this.game, pSize, tail.x, tail.y);
                FOOD.push(f);
            }
        }
        let csUp = Math.pow((this.score) / 1000, 1 / 5);
        this.size = this.game.getSize() / 2 * csUp;
        
        // Uppdatera ormens längd (antal segment)
        const baseSegments = 50; // Minsta antal segment
        const segmentsPerScoreUnit = 0.1; // Hur många segment per poäng
        let targetN = Math.round(baseSegments + (this.score * segmentsPerScoreUnit));

        // Kläm fast längden inom rimliga gränser
        if (targetN < baseSegments) targetN = baseSegments;
        if (targetN > 500) targetN = 500; // Förhindra extremt långa ormar

        // Justera längden gradvis
        while (this.v.length < targetN) {
            this.v.push({ x: this.v[this.v.length - 1].x, y: this.v[this.v.length - 1].y });
        }
        while (this.v.length > targetN) {
            this.v.pop();
        }
    }

    draw() {
        const ctx = this.game.context;
        const isPlayer = window.mySnake && this === window.mySnake[0];

        // Rita kroppen
        for (let i = this.v.length - 1; i >= 1; i--) {
            if (this.game.isPoint(this.v[i].x, this.v[i].y)) {
                // Ensure XX and YY are accessed from global scope correctly
                const currentXX = globalThis.XX || 0;
                const currentYY = globalThis.YY || 0;
                const drawX = this.v[i].x - currentXX;
                const drawY = this.v[i].y - currentYY;

                if (this.bd_im.complete && this.bd_im.naturalWidth !== 0) {
                    ctx.drawImage(this.bd_im, drawX - this.size / 2, drawY - this.size / 2, this.size, this.size);
                } else {
                    // Fallback om bilder saknas: Rita cirklar
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, this.size / 2, 0, Math.PI * 2);
                    ctx.fillStyle = isPlayer ? 'var(--accent)' : '#444'; // Use var(--accent) for player
                    ctx.fill();
                }
            }
        }

        // Rita huvudet
        const currentXX = globalThis.XX || 0;
        const currentYY = globalThis.YY || 0;
        const hX = this.v[0].x - currentXX;
        const hY = this.v[0].y - currentYY;

        if (this.sn_im.complete && this.sn_im.naturalWidth !== 0) {
            ctx.save();
            ctx.translate(hX, hY);
            ctx.rotate(this.angle - Math.PI / 2);
            ctx.drawImage(this.sn_im, -this.size / 2, -this.size / 2, this.size, this.size);
            ctx.restore();
        } else {
            // Fallback för huvudet
            ctx.beginPath();
            ctx.arc(hX, hY, this.size / 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = isPlayer ? 'var(--accent)' : '#666'; // Use var(--accent) for player
            ctx.fill();
        }
    }

    getAngle(a, b) {
        let c = Math.sqrt(a * a + b * b);
        let al = Math.acos(a / c);
        if (b < 0)
            al += 2 * (Math.PI - al);
        return al;
    }

    range(v1, v2) {
        return Math.sqrt((v1.x - v2.x) * (v1.x - v2.x) + (v1.y - v2.y) * (v1.y - v2.y));
    }
}