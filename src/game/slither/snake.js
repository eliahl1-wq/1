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

        // Endast AI-ormar flyttar huvudet här (Spelaren flyttas i game.js)
        if (this !== window.mySnake?.[0]) {
            this.v[0].x += this.dx * this.speed;
            this.v[0].y += this.dy * this.speed;
        }

        for (let i = 1; i < this.v.length; i++) {
            if (this.range(this.v[i], this.v[i - 1]) > this.size / 5) {
                this.v[i].x = (this.v[i].x + this.v[i - 1].x) / 2;
                this.v[i].y = (this.v[i].y + this.v[i - 1].y) / 2;
            }
        }
        if (this.score < 200)
            return;
        if (this.speed == 2)
            this.score -= this.score / 2000;;
        let csUp = Math.pow((this.score) / 1000, 1 / 5);
        this.size = this.game.getSize() / 2 * csUp;
        let N = 3 * Math.floor(50 * Math.pow((this.score) / 1000, 1 / 1));
        if (N > this.v.length) {
            this.v[this.v.length] = { x: this.v[this.v.length - 1].x, y: this.v[this.v.length - 1].y };
        } else
            this.v = this.v.slice(0, N);
    }

    draw() {
        this.update();
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