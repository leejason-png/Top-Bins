import { init, GameLoop, keyPressed, initKeys } from 'https://unpkg.com/kontra/kontra.mjs';
import { createBall, shootBall, updateBall, resetBall } from './ball.js';
import { createGoalie, updateGoalie } from './goalie.js';
import { generateDefenders, handleDefenderCollision } from './defenders.js';
import { getState, chooseAction, updateQ } from './qlearning.js';

let { canvas, context } = init();
initKeys();

canvas.width = 800;
canvas.height = 600;
canvas.style.background = "#2e8b57";

const GOAL_LEFT = 250;
const GOAL_RIGHT = 550;
const GOAL_Y = 50;
const SAVE_ZONE_Y = 120;

let ball = createBall(390, 500);
let goalie = createGoalie();
let defenders = [];
let bounceCooldown = { value: 0 };

let gameStarted = false;
let level = 1;
let shotsLeft = 3;
let aimAngle = 0;
let power = 6;

let currentState = null;
let currentAction = null;

let loop = GameLoop({
    update() {

        // START
        if (!gameStarted && keyPressed("enter")) {
            defenders = generateDefenders(level);
            shotsLeft = 3;
            gameStarted = true;
        }

        if (!gameStarted) return;

        // AIM
        if (!ball.moving) {
            if (keyPressed("arrowleft")) aimAngle = Math.max(-45, aimAngle - 2);
            if (keyPressed("arrowright")) aimAngle = Math.min(45, aimAngle + 2);
            if (keyPressed("arrowdown")) aimAngle = 0;

            if (keyPressed("arrowup")) {
                power = Math.min(12, power + 0.1);
            } else {
                power = Math.max(4, power - 0.05);
            }
        }

        // SHOOT
        if (!ball.moving && keyPressed("space")) {
            shootBall(ball, aimAngle, power);

            currentState = getState(ball.x, ball.dx, GOAL_LEFT);
            currentAction = chooseAction(currentState);

            if (currentAction === 0) {
                currentAction = Math.random() < 0.5 ? -1 : 1;
            }

            goalie.direction = currentAction;
        }

        // UPDATE
        updateBall(ball);
        updateGoalie(goalie, ball, currentAction, GOAL_LEFT, GOAL_RIGHT);
        handleDefenderCollision(ball, defenders, bounceCooldown);

        // SAVE
        let hitGoalie =
            ball.y < SAVE_ZONE_Y &&
            ball.x > goalie.x &&
            ball.x < goalie.x + goalie.width;

        if (hitGoalie) {
            updateQ(currentState, currentAction, +1);
            shotsLeft--;
            resetBall(ball);
        }

        // GOAL
        else if (ball.y <= GOAL_Y) {
            let goal = ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT;

            if (goal) {
                updateQ(currentState, currentAction, -1);
                level++;

                // 🔥 THIS WAS YOUR MISSING LINE
                defenders = generateDefenders(level);

                gameStarted = false;
            }

            shotsLeft--;
            resetBall(ball);
        }

        // MISS
        if (ball.y > canvas.height) {
            shotsLeft--;
            resetBall(ball);
        }

        // FAIL
        if (shotsLeft <= 0) {
            gameStarted = false;
        }
    },

    render() {
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameStarted) {
            context.fillStyle = "white";
            context.font = "40px Arial";
            context.fillText("TOP BINS", 300, 200);
            context.fillText("Press ENTER", 280, 300);
            return;
        }

        // UI
        context.fillStyle = "white";
        context.fillText("Level: " + level, 20, 30);
        context.fillText("Shots: " + shotsLeft, 20, 60);

        // GOAL
        context.fillRect(GOAL_LEFT, GOAL_Y, GOAL_RIGHT - GOAL_LEFT, 20);

        // DEFENDERS
        defenders.forEach(d => {
            context.save();
            context.translate(d.x + d.width / 2, d.y + d.height / 2);
            context.rotate(d.angle * Math.PI / 180);
            context.fillStyle = "blue";
            context.fillRect(-d.width / 2, -d.height / 2, d.width, d.height);
            context.restore();
        });

        // GOALIE
        context.fillStyle = "red";
        context.fillRect(goalie.x, goalie.y, goalie.width, goalie.height);

        // BALL
        context.beginPath();
        context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context.fillStyle = "black";
        context.fill();

        // AIM LINE
        if (!ball.moving) {
            let rad = aimAngle * Math.PI / 180;

            context.beginPath();
            context.moveTo(ball.x, ball.y);
            context.lineTo(
                ball.x + Math.sin(rad) * 40,
                ball.y - Math.cos(rad) * 40
            );

            context.strokeStyle = "white";
            context.stroke();

            context.fillText("Power: " + power.toFixed(1), 20, 560);
        }
    }
});

loop.start();