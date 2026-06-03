globalThis.game_W = 0;
globalThis.game_H = 0;
globalThis.Nball = 200;

globalThis.SPEED = 1;
globalThis.MaxSpeed = 0;
globalThis.chX = 0;
globalThis.chY = 0;
globalThis.mySnake = [];
globalThis.FOOD = [];
globalThis.NFood = 2000;
globalThis.Nsnake = 20;
globalThis.sizeMap = 2000;
globalThis.index = 0;
globalThis.minScore = 200;
globalThis.die = false;

globalThis.Xfocus = 0;
globalThis.Yfocus = 0;
globalThis.XX = 0;
globalThis.YY = 0;

const names = ["Ahmed Steinke",
    "Aubrey Brass",
    "Johanne Boothe",
    "Sunni Markland",
    "Tifany Sugar",
    "Latonya Tully",
    "Bobette Huckaby",
    "Daryl Nowicki",
    "Lizeth Kremer",
    "Chiquita Pitt",
    "Christinia Siler",
    "Rena Reep",
    "Evan Mcknight",
    "Sofia Freeland",
    "Virgie Vaughns",
    "Kit Polen",
    "Emma Rutland",
    "Queen Guertin",
    "Cecily Pasquariello",
    "Palmer Myer",
    "Kera Quinton",
    "Domonique Diebold",
    "Henriette Sockwell",
    "Adeline Pettway",
    "Shu Osby",
    "Shantay Wallner",
    "Isaias Drewes",
    "Lettie Gatz",
    "Remona Maravilla",
    "Jessenia Mick",
    "Noelle Rickey",
    "Lavon Revard",
    "Shavonne Stogsdill",
    "Hailey Razo",
    "Bart Somerville",
    "Hannah Masker",
    "Frederica Farmer",
    "Glennie Thorpe",
    "Sherrell Arriaga",
    "Lawanda Maines",
    "Douglass Watts",
    "Naida Grund",
    "Branda Bussiere",
    "Carmelo Savory",
    "Gabriela Blanchette",
    "Tran Huf",
    "Antoinette Hinrichs",
    "Deborah Primmer",
    "Drusilla Mcvea",
    "Charlsie Acy",
    "Nadene Royce",
    "Danette Touchet",
    "Luana Endo",
    "Elvina Hibbitts",
    "Ludivina Dahle",
    "Fabiola Mcwhirter",
    "Isabella Mosier",
    "Lon Lassiter",
    "Laurence Hanning",
    "NamZ Bede"
];

globalThis.game = class game {
    constructor() {
        // Constructor now accepts a canvas element
        this.canvas = arguments[0];
        this.context = this.canvas.getContext("2d");
        this.init(this.canvas);
    }

    init(canvasElement) {
        // Use the provided canvas element
        globalThis.die = false; // Reset die state to prevent freezing on re-entry
        globalThis.XX = 0;
        globalThis.YY = 0;
        this.render();

        // Spelarens orm (namnet sätts av React i SlitherGame.jsx)
        mySnake[0] = new window.snake("Player", this, minScore, game_W / 2, game_H / 2);

        // Spawn initial food (Värt $7.00 = 700 units)
        // Spawnas dubbelt så mycket som Agar för att täcka ytan
        for (let i = 0; i < 700; i++) {
            FOOD[i] = new window.food(this, this.getSize() / 8, (Math.random() - Math.random()) * sizeMap, (Math.random() - Math.random()) * sizeMap);
        }

        this.loop();

        this.listenMouse();
        this.listenTouch();
    }

    listenTouch() {
        document.addEventListener("touchmove", evt => {
            var y = evt.touches[0].pageY;
            var x = evt.touches[0].pageX;
            chX = (x - game_W / 2) / 15;
            chY = (y - game_H / 2) / 15;
        })

        document.addEventListener("touchstart", evt => {
            var y = evt.touches[0].pageY;
            var x = evt.touches[0].pageX;
            chX = (x - game_W / 2) / 15;
            chY = (y - game_H / 2) / 15;
            mySnake[0].speed = 2;
        })

        document.addEventListener("touchend", evt => {
            mySnake[0].speed = 1;
        })
    }

    listenMouse() {
        document.addEventListener("mousedown", evt => {
            var x = evt.offsetX == undefined ? evt.layerX : evt.offsetX;
            var y = evt.offsetY == undefined ? evt.layerY : evt.offsetY;
            mySnake[0].speed = 2;
        })

        document.addEventListener("mousemove", evt => {
            var x = evt.offsetX == undefined ? evt.layerX : evt.offsetX;
            var y = evt.offsetY == undefined ? evt.layerY : evt.offsetY;
            chX = (x - game_W / 2) / 15;
            chY = (y - game_H / 2) / 15;
        })

        document.addEventListener("mouseup", evt => {
            var x = evt.offsetX == undefined ? evt.layerX : evt.offsetX;
            var y = evt.offsetY == undefined ? evt.layerY : evt.offsetY;
            mySnake[0].speed = 1;
        })
    }

    loop() {
        this.update();
        this.draw();
        if (die) return; // Stoppa loopen EFTER att sista rutan ritats
        setTimeout(() => this.loop(), 30);
    }

    update() {
        this.render();
        this.unFood(); // Hanterar att äta food
        this.changeSnake();
        this.updateChXY();
        this.checkDie();

        mySnake[0].dx = chX;
        mySnake[0].dy = chY;
        XX += chX * mySnake[0].speed;
        YY += chY * mySnake[0].speed;
        mySnake[0].v[0].x = XX + game_W / 2;
        mySnake[0].v[0].y = YY + game_H / 2;
    }

    updateChXY() {
        while (Math.abs(chY) * Math.abs(chY) + Math.abs(chX) * Math.abs(chX) > MaxSpeed * MaxSpeed && chY * chX != 0) {
            chX /= 1.1;
            chY /= 1.1;
        }
        while (Math.abs(chY) * Math.abs(chY) + Math.abs(chX) * Math.abs(chX) < MaxSpeed * MaxSpeed && chY * chX != 0) {
            chX *= 1.1;
            chY *= 1.1;
        }

        Xfocus += 1.5 * chX * mySnake[0].speed;
        Yfocus += 1.5 * chY * mySnake[0].speed;
    }

    changeFood() {
        // Random food spawn borttagen - styrs nu av join-logik och döda spelare
    }

    changeSnake() {
        for (let i = 0; i < mySnake.length; i++)
            if (Math.sqrt((mySnake[0].v[0].x - mySnake[i].v[0].x) * (mySnake[0].v[0].x - mySnake[i].v[0].x) + (mySnake[0].v[0].y - mySnake[i].v[0].y) * (mySnake[0].v[0].y - mySnake[i].v[0].y)) > sizeMap) {
                mySnake[i].v[0].x = (mySnake[0].v[0].x + mySnake[i].v[0].x) / 2;
                mySnake[i].v[0].y = (mySnake[0].v[0].y + mySnake[i].v[0].y) / 2;
            }
    }

    unFood() {
        if (mySnake.length <= 0)
            return;
        for (let i = 0; i < mySnake.length; i++)
            for (let j = 0; j < FOOD.length; j++) {
                if ((mySnake[i].v[0].x - FOOD[j].x) * (mySnake[i].v[0].x - FOOD[j].x) + (mySnake[i].v[0].y - FOOD[j].y) * (mySnake[i].v[0].y - FOOD[j].y) < 1.5 * mySnake[i].size * mySnake[i].size) {
                    mySnake[i].score += Math.floor(FOOD[j].value);
                    FOOD.splice(j, 1); // Ta bort food istället för att spawna ny slumpmässig
                }
            }
    }

    checkDie() {
        for (let i = 0; i < mySnake.length; i++)
            for (let j = 0; j < mySnake.length; j++)
                if (i != j) {
                    let kt = true;
                    for (let k = 0; k < mySnake[j].v.length; k++)
                        if (this.range(mySnake[i].v[0].x, mySnake[i].v[0].y, mySnake[j].v[k].x, mySnake[j].v[k].y) < mySnake[i].size)
                            kt = false;
                    if (!kt) {
                        for (let k = 0; k < mySnake[i].v.length; k += 5) {
                            FOOD[index] = new window.food(this, this.getSize() / (2 + Math.random() * 2), mySnake[i].v[k].x + Math.random() * mySnake[i].size / 2, mySnake[i].v[k].y + Math.random() * mySnake[i].size / 2);
                            FOOD[index++].value = 0.4 * mySnake[i].score / (mySnake[i].v.length / 5);
                            if (index >= FOOD.length)
                                index = 0;
                        }
                        if (i != 0)
                            mySnake[i] = new window.snake(names[Math.floor(Math.random() * 99999) % names.length], this, Math.max(Math.floor((mySnake[0].score > 10 * minScore) ? mySnake[0].score / 10 : minScore), mySnake[i].score / 10), this.randomXY(XX), this.randomXY(YY));
                        else {
                            // Anropa React istället för alert
                            if (window.onSnakeDie) window.onSnakeDie(mySnake[i].score);
                            die = true;
                        }
                    } else if (i === 0 && mySnake[0].speed === 2 && mySnake[0].score > minScore * 2) { // Player cashout
                        // Simulate cashout if player is boosting and has enough score
                        // This is a placeholder, actual cashout should be triggered by UI
                        // if (window.onCashOut) window.onCashOut(mySnake[0].score);
                        // die = true;
                    }
                }
    }

    render() {
        if (this.canvas.width != document.documentElement.clientWidth || this.canvas.height != document.documentElement.clientHeight) {
            this.canvas.width = document.documentElement.clientWidth;
            this.canvas.height = document.documentElement.clientHeight;
            globalThis.game_W = this.canvas.width;
            globalThis.game_H = this.canvas.height;
            SPEED = this.getSize() / 7;
            SPEED = 1;
            MaxSpeed = this.getSize() / 7;
            if (mySnake.length == 0)
                return;
            if (mySnake[0].v != null) {
                mySnake[0].v[0].x = globalThis.XX + globalThis.game_W / 2;
                mySnake[0].v[0].y = globalThis.YY + globalThis.game_H / 2;
            }
        }
    }

    draw() {
        this.clearScreen();
        for (let i = 0; i < FOOD.length; i++)
            FOOD[i].draw();
        for (let i = 0; i < mySnake.length; i++)
            mySnake[i].draw();
    }

    clearScreen() {
        // Mörk bakgrund som i Agario
        this.context.fillStyle = '#0a0a0c';
        this.context.fillRect(0, 0, globalThis.game_W, globalThis.game_H);

        // Rita rutnät (Grid)
        const step = 45;
        this.context.beginPath();
        this.context.strokeStyle = '#1d1d1f'; // Subtila linjer
        this.context.lineWidth = 1;
        
        // Ensure XX and YY are numbers, default to 0 if undefined
        const currentXX = globalThis.XX || 0;
        const currentYY = globalThis.YY || 0;

        // Offset baserat på kamerans position (XX, YY)
        for (let x = -currentXX % step; x < globalThis.game_W; x += step) {
            this.context.moveTo(x, 0);
            this.context.lineTo(x, globalThis.game_H);
        }
        for (let y = -currentYY % step; y < globalThis.game_H; y += step) {
            this.context.moveTo(0, y);
            this.context.lineTo(globalThis.game_W, y);
        }
        this.context.stroke();
    }

    getSize() {
        var area = globalThis.game_W * globalThis.game_H;
        return Math.sqrt(area / 300);
    }

    range(a, b, c, d) {
        return Math.sqrt((a - c) * (a - c) + (b - d) * (b - d));
    }

    randomXY(n) {
        let ans = 0;
        while (Math.abs(ans) < 1) {
            ans = 3 * Math.random() - 3 * Math.random();
        }
        return ans * sizeMap + n;
    }

    isPoint(x, y) {
        const currentXX = globalThis.XX || 0;
        const currentYY = globalThis.YY || 0;
        const currentGameW = globalThis.game_W || 0;
        const currentGameH = globalThis.game_H || 0;

        if (x - currentXX < -3 * this.getSize())
            return false;
        if (y - currentYY < -3 * this.getSize())
            return false;
        if (x - currentXX > currentGameW + 3 * this.getSize())
            return false;
        if (y - currentYY > currentGameH + 3 * this.getSize())
            return false;
        return true;
    }
}
// Exponera klassen globalt så SlitherGame.jsx kan hitta den
window.game = game;

// Add a destroy method for cleanup
game.prototype.destroy = function() {
    // Any specific cleanup for the game instance
};