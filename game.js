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

let ball = {
    x: 390,
    y: 500,
    radius: 15,
    speed: 7,
    moving: false
};

function resetBall() {
    ball.x = 390;
    ball.y = 500;
    ball.moving = false;
}

let loop = GameLoop({
    update() {
        // ENTER starts game
        if (!gameStarted && keyPressed("enter")) {
            gameStarted = true;
        }

        if (gameStarted) {
            // SPACE shoots
            if (keyPressed("space") && !ball.moving) {
                ball.moving = true;
            }

            if (ball.moving) {
                ball.y -= ball.speed;
            }

            if (ball.y < 0) {
                resetBall();
            }
        }
    },

    render() {
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameStarted) {
            // TITLE SCREEN
            context.fillStyle = "white";
            context.font = "50px Arial";
            context.fillText("TOP BINS", 280, 200);

            context.font = "25px Arial";
            context.fillText("Press ENTER to Play", 270, 300);
            return;
        }

        // GAME SCREEN
        context.fillStyle = "white";
        context.font = "30px Arial";
        context.fillText("TOP BINS", 320, 40);

        context.font = "20px Arial";
        context.fillText("Press SPACE to Shoot", 280, 560);

        // goal
        context.fillRect(250, 50, 300, 20);

        // ball
        context.beginPath();
        context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context.fillStyle = "black";
        context.fill();
        context.closePath();
    }
});

loop.start();