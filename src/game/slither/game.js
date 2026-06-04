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
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.context = canvasElement.getContext("2d");
        
        // Bind event handlers to instance so they can be removed safely
        this.handleResize = this.render.bind(this);
        this.handleTouchMove = this.onTouchMove.bind(this);
        this.handleTouchStart = this.onTouchStart.bind(this);
        this.handleTouchEnd = this.onTouchEnd.bind(this);
        this.handleMouseDown = this.onMouseDown.bind(this);
        this.handleMouseMove = this.onMouseMove.bind(this);
        this.handleMouseUp = this.onMouseUp.bind(this);
        
        this.init(canvasElement);
    }

    init(canvasElement) {
        globalThis.die = false; // Reset die state to prevent freezing on re-entry
        globalThis.mySnake = [];
        globalThis.FOOD = [];
        globalThis.XX = 0;
        globalThis.YY = 0;
        globalThis.chX = 0;
        globalThis.chY = 0;

        globalThis.game_W = canvasElement.width = document.documentElement.clientWidth;
        globalThis.game_H = canvasElement.height = document.documentElement.clientHeight;
        globalThis.SPEED = 0.5; // Balanserad basfart för att kontrollera snabbheten
        globalThis.MaxSpeed = (this.getSize() || 100) / 25; // Stabilare svänghastighet

        // Spelarens orm (namnet sätts av React i SlitherGame.jsx)
        mySnake[0] = new window.snake("Player", this, minScore, 0, 0); // Starta vid 0,0, kameran kommer att centrera
        for (let i = 0; i < 1400; i++) {
            FOOD[i] = new window.food(this, this.getSize() / 8, (Math.random() - Math.random()) * sizeMap, (Math.random() - Math.random()) * sizeMap);
        }

        window.addEventListener('resize', this.handleResize);
        this.addEventListeners();
        this.loop();
    }

    addEventListeners() {
        document.addEventListener("touchmove", this.handleTouchMove);
        document.addEventListener("touchstart", this.handleTouchStart);
        document.addEventListener("touchend", this.handleTouchEnd);
        document.addEventListener("mousedown", this.handleMouseDown);
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
    }

    removeEventListeners() {
        document.removeEventListener("touchmove", this.handleTouchMove);
        document.removeEventListener("touchstart", this.handleTouchStart);
        document.removeEventListener("touchend", this.handleTouchEnd);
        document.removeEventListener("mousedown", this.handleMouseDown);
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
    }

    onTouchMove(evt) {
        var y = evt.touches[0].pageY;
        var x = evt.touches[0].pageX;
        chX = (x - game_W / 2) / 100;
        chY = (y - game_H / 2) / 100;
    }

    onTouchStart(evt) {
        var y = evt.touches[0].pageY;
        var x = evt.touches[0].pageX;
        chX = (x - game_W / 2) / 100;
        chY = (y - game_H / 2) / 100;
        if (mySnake[0]) mySnake[0].speed = 2;
    }

    onTouchEnd() {
        if (mySnake[0]) mySnake[0].speed = 1;
    }

    onMouseDown() {
        if (mySnake[0]) mySnake[0].speed = 2;
    }

    onMouseMove(evt) {
        var x = evt.offsetX == undefined ? evt.layerX : evt.offsetX;
        var y = evt.offsetY == undefined ? evt.layerY : evt.offsetY;
        chX = (x - game_W / 2) / 50;
        chY = (y - game_H / 2) / 50;
    }

    onMouseUp() {
        if (mySnake[0]) mySnake[0].speed = 1;
    }

    loop() {
        this.update();
        this.draw();
        if (die) return; // Stoppa loopen EFTER att sista rutan ritats
        setTimeout(() => this.loop(), 30);
    }

    update() {
        // Removed this.render() from here. It should only be called on resize.
        this.unFood(); // Hanterar att äta food
        
        if (!mySnake || !mySnake[0]) return;

        // Koppla mus-input till spelarormen
        mySnake[0].dx = globalThis.chX;
        mySnake[0].dy = globalThis.chY;

        // Uppdatera spelarormens egen rörelse
        mySnake[0].update(); // Denna kommer nu att uppdatera mySnake[0].v[0].x och y

        // Uppdatera kameran (XX, YY) för att följa spelarormen mjukt
        const targetXX = mySnake[0].v[0].x - globalThis.game_W / 2;
        const targetYY = mySnake[0].v[0].y - globalThis.game_H / 2;

        // Mjuk interpolering för kameran
        globalThis.XX += (targetXX - globalThis.XX) * 0.1; // Justera 0.1 för önskad mjukhet
        globalThis.YY += (targetYY - globalThis.YY) * 0.1; // Justera 0.1 för önskad mjukhet

        this.changeSnake();
        this.updateChXY();
        this.checkDie();
    }

    updateChXY() {
        // Normalisera chX och chY för att ligga inom MaxSpeed-gränserna
        const currentMagnitude = Math.sqrt(chX * chX + chY * chY);
        if (currentMagnitude > globalThis.MaxSpeed) {
            const scale = globalThis.MaxSpeed / currentMagnitude;
            chX *= scale;
            chY *= scale;
        }
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
        // Spelarens kollision med egen kropp
        if (mySnake.length > 0 && mySnake[0].v.length > 5) { // Se till att ormen har tillräckligt många segment
            const head = mySnake[0].v[0];
            for (let k = 5; k < mySnake[0].v.length; k++) { // Börja kolla från några segment bakåt
                if (this.range(head.x, head.y, mySnake[0].v[k].x, mySnake[0].v[k].y) < mySnake[0].size) {
                    if (window.onSnakeDie) window.onSnakeDie(mySnake[0].score);
                    die = true;
                    return; // Spelaren dog, ingen mer kollision behöver kollas
                }
            }
        }

        // Spelarens kollision med väggar
        // Antar att sizeMap definierar världens gränser från centrum (t.ex. -sizeMap/2 till +sizeMap/2)
        if (mySnake.length > 0) {
            const head = mySnake[0].v[0];
            const halfSizeMap = globalThis.sizeMap / 2;
            // Lägg till en liten buffert för att förhindra omedelbar död vid kanten
            const collisionBuffer = mySnake[0].size / 2; 
            if (head.x < -halfSizeMap + collisionBuffer || head.x > halfSizeMap - collisionBuffer || 
                head.y < -halfSizeMap + collisionBuffer || head.y > halfSizeMap - collisionBuffer) {
                if (window.onSnakeDie) window.onSnakeDie(mySnake[0].score);
                die = true;
                return; // Spelaren dog, ingen mer kollision behöver kollas
            }
        }

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
            // Återberäkna MaxSpeed baserat på ny canvasstorlek
            globalThis.MaxSpeed = (this.getSize() || 100) / 25; // Uppdatera MaxSpeed vid resize
        }
    }

    draw() {
        this.clearScreen();
        // Rita food först, sedan ormar, så ormarna är ovanpå food
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
    // Ensure event listeners are removed only if they were added and are defined
    if (this.handleResize) window.removeEventListener('resize', this.handleResize); // This is bound in constructor
    if (this.handleTouchMove) document.removeEventListener("touchmove", this.handleTouchMove); // These are bound in constructor
    if (this.handleTouchStart) document.removeEventListener("touchstart", this.handleTouchStart);
    if (this.handleTouchEnd) document.removeEventListener("touchend", this.handleTouchEnd);
    if (this.handleMouseDown) document.removeEventListener("mousedown", this.handleMouseDown);
    if (this.handleMouseMove) document.removeEventListener("mousemove", this.handleMouseMove);
    if (this.handleMouseUp) document.removeEventListener("mouseup", this.handleMouseUp);
    globalThis.die = true;
};