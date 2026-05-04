import {
    init,
    GameLoop,
    keyPressed,
    initKeys
} from 'https://unpkg.com/kontra/kontra.mjs';

let { canvas, context } = init();
initKeys();

canvas.width = 800;
canvas.height = 600;
canvas.style.background = "#2e8b57";

let gameStarted = false;
let result = "";

// BALL
let ball = {
    x: 390,
    y: 500,
    radius: 15,
    speed: 7,
    moving: false
};

// GOALIE
let goalie = {
    x: 350,
    y: 70,
    width: 100,
    height: 20,
    speed: 6,
    direction: null
};

// RESET FUNCTION (ONLY resets — no logic inside)
function resetBall() {
    ball.x = 390;
    ball.y = 500;
    ball.moving = false;

    goalie.x = 350;
    goalie.direction = null;
}

let loop = GameLoop({
    update() {

        // start game
        if (!gameStarted && keyPressed("enter")) {
            gameStarted = true;
        }

        if (!gameStarted) return;

        // shoot
        if (keyPressed("space") && !ball.moving) {
            ball.moving = true;
        }

        // move ball
        if (ball.moving) {
            ball.y -= ball.speed;
        }

        // goalie chooses direction ONCE
        if (ball.moving && goalie.direction === null) {
            let rand = Math.floor(Math.random() * 3);

            if (rand === 0) goalie.direction = -1; // left
            else if (rand === 1) goalie.direction = 0; // center
            else goalie.direction = 1; // right
        }

        // move goalie (only if diving)
        if (goalie.direction !== 0 && goalie.direction !== null) {
            goalie.x += goalie.direction * goalie.speed;
        }

        // GOAL / SAVE detection
        if (ball.moving && ball.y <= 70) {

            let shot;

            if (ball.x < 350) shot = -1;
            else if (ball.x > 450) shot = 1;
            else shot = 0;

            if (shot === goalie.direction) {
                result = "SAVED!";
            } else {
                result = "GOAL!";
            }

            resetBall();
        }
    },

    render() {
        context.clearRect(0, 0, canvas.width, canvas.height);

        // TITLE SCREEN
        if (!gameStarted) {
            context.fillStyle = "white";
            context.font = "50px Arial";
            context.fillText("TOP BINS", 280, 200);

            context.font = "25px Arial";
            context.fillText("Press ENTER to Play", 270, 300);
            return;
        }

        // UI
        context.fillStyle = "white";
        context.font = "30px Arial";
        context.fillText("TOP BINS", 320, 40);

        context.font = "20px Arial";
        context.fillText("Press SPACE to Shoot", 280, 560);

        context.font = "30px Arial";
        context.fillText(result, 330, 200);

        // GOAL
        context.fillStyle = "white";
        context.fillRect(250, 50, 300, 20);

        // GOALIE
        if (goalie.direction === 0) {
            context.fillStyle = "yellow"; // center
        } else {
            context.fillStyle = "red"; // diving
        }
        context.fillRect(goalie.x, goalie.y, goalie.width, goalie.height);

        // BALL
        context.beginPath();
        context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context.fillStyle = "black";
        context.fill();
        context.closePath();
    }
});

loop.start();