import {
    init,
    GameLoop,
    keyPressed,
    initKeys
} from 'https://unpkg.com/kontra/kontra.mjs';

let { canvas, context } = init();
initKeys();

// ─── Q LEARNING ───────────────────────────────────────────────────────────────
let Q = {};
const ACTIONS = [-1, 0, 1];

const ALPHA = 0.01;
const GAMMA = 0.9;
const EPSILON = 0.2;

let currentState = null;
let currentAction = null;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const GOAL_LEFT   = 250;
const GOAL_RIGHT  = 550;
const GOAL_Y      = 50;
const SAVE_ZONE_Y = 120;

const BALL_START_X = 390;
const BALL_START_Y = 500;

const MAX_SHOTS = 5;

const AIM_RANGE  = 45;
const AIM_SPEED  = 2;

const MIN_POWER = 4;
const MAX_POWER = 12;
const POWER_CHARGE_SPEED = 0.1;

// ─── CANVAS ───────────────────────────────────────────────────────────────────
canvas.width = 800;
canvas.height = 600;
canvas.style.background = "#2e8b57";

// ─── STATE ────────────────────────────────────────────────────────────────────
let gameStarted = false;
let result = "";
let finalResult = "";
let aimAngle = 0;
let power = MIN_POWER;
let score = 0;
let shots = 0;

// ─── BALL ─────────────────────────────────────────────────────────────────────
let ball = {
    x: BALL_START_X,
    y: BALL_START_Y,
    radius: 15,
    moving: false,
    dx: 0,
    dy: 0
};

// ─── GOALIE ───────────────────────────────────────────────────────────────────
let goalie = {
    x: 350,
    y: 70,
    width: 100,
    height: 20,
    speed: 3,
    direction: 0
};

// ─── Q HELPERS ────────────────────────────────────────────────────────────────
function getState(x, dx, powerVal) {
    let bucket = Math.floor((x - GOAL_LEFT) / ((GOAL_RIGHT - GOAL_LEFT) / 5));
    bucket = Math.max(0, Math.min(4, bucket));

    let dir = 0;
    if (dx < -1) dir = -1;
    else if (dx > 1) dir = 1;

    let powerBucket = Math.floor((powerVal - MIN_POWER) / ((MAX_POWER - MIN_POWER) / 3));
    powerBucket = Math.max(0, Math.min(2, powerBucket));

    return `${bucket}_${dir}_${powerBucket}`;
}

function chooseAction(state) {
    if (!Q[state]) Q[state] = { "-1": 0, "0": 0, "1": 0 };

    if (Math.random() < EPSILON) {
        return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    }

    let best = 0;
    let bestVal = -Infinity;

    for (let a of ACTIONS) {
        if (Q[state][a] > bestVal) {
            bestVal = Q[state][a];
            best = a;
        }
    }

    return best;
}

function updateQ(state, action, reward) {
    if (!Q[state]) Q[state] = { "-1": 0, "0": 0, "1": 0 };

    Q[state][action] += ALPHA * (reward - Q[state][action]);
}

// ─── BACKGROUND TRAINING ──────────────────────────────────────────────────────
function trainAI(iterations = 2000) {
    for (let i = 0; i < iterations; i++) {

        let x = BALL_START_X;
        let y = BALL_START_Y;

        let angle = (Math.random() * AIM_RANGE * 2 - AIM_RANGE) * Math.PI / 180;
        let p = Math.random() * (MAX_POWER - MIN_POWER) + MIN_POWER;

        let dx = Math.sin(angle) * p;
        let dy = -Math.cos(angle) * p;

        let goalieX = 350;

        let state = getState(x, dx, p);
        let action = chooseAction(state);

        while (y > GOAL_Y) {
            x += dx;
            y += dy;

            if (action === -1) goalieX -= 3;
            if (action === 1) goalieX += 3;

            goalieX = Math.max(GOAL_LEFT, Math.min(goalieX, GOAL_RIGHT - 100));

            let hit =
                y < SAVE_ZONE_Y &&
                x > goalieX &&
                x < goalieX + 100;

            if (hit) {
                updateQ(state, action, +1);
                break;
            }
        }

        if (y <= GOAL_Y) {
            let within = x > GOAL_LEFT && x < GOAL_RIGHT;
            if (within) updateQ(state, action, -1);
        }
    }
}

// ─── RESET ────────────────────────────────────────────────────────────────────
function resetBall() {
    ball.x = BALL_START_X;
    ball.y = BALL_START_Y;
    ball.moving = false;
    ball.dx = 0;
    ball.dy = 0;

    power = MIN_POWER;
    goalie.x = 350;
    goalie.direction = 0;
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
let loop = GameLoop({

    update() {

        if (!gameStarted && keyPressed("enter")) {
            trainAI(2000); // 🔥 background training

            gameStarted = true;
            result = "";
            finalResult = "";
            aimAngle = 0;
            power = MIN_POWER;
        }

        if (!gameStarted) return;

        // AIM + POWER (UNCHANGED)
        if (!ball.moving) {
            if (keyPressed("arrowleft"))  aimAngle = Math.max(-AIM_RANGE, aimAngle - AIM_SPEED);
            if (keyPressed("arrowright")) aimAngle = Math.min( AIM_RANGE, aimAngle + AIM_SPEED);
            if (keyPressed("arrowdown"))  aimAngle = 0;

            if (keyPressed("arrowup")) power = Math.min(MAX_POWER, power + POWER_CHARGE_SPEED);
            else power = Math.max(MIN_POWER, power - POWER_CHARGE_SPEED);
        }

        // SHOOT + AI
        if (keyPressed("space") && !ball.moving) {
            ball.moving = true;

            const rad = (aimAngle * Math.PI) / 180;
            ball.dx = Math.sin(rad) * power;
            ball.dy = -Math.cos(rad) * power;

            currentState = getState(ball.x, ball.dx, power);
            currentAction = chooseAction(currentState);

            goalie.direction = currentAction;
        }

        // MOVE BALL
        if (ball.moving) {
            ball.x += ball.dx;
            ball.y += ball.dy;
        }

        // MOVE GOALIE
        if (goalie.direction === -1) goalie.x -= goalie.speed;
        if (goalie.direction === 1) goalie.x += goalie.speed;

        goalie.x = Math.max(GOAL_LEFT, Math.min(goalie.x, GOAL_RIGHT - goalie.width));

        // COLLISION
        if (ball.moving) {
            const hitGoalie =
                ball.y < SAVE_ZONE_Y &&
                ball.x + ball.radius > goalie.x &&
                ball.x - ball.radius < goalie.x + goalie.width &&
                ball.y - ball.radius < goalie.y + goalie.height &&
                ball.y + ball.radius > goalie.y;

            if (hitGoalie) {
                result = "SAVED!";
                shots++;

                updateQ(currentState, currentAction, +1);
                resetBall();

            } else if (ball.y <= GOAL_Y) {
                const withinPosts =
                    ball.x + ball.radius > GOAL_LEFT &&
                    ball.x - ball.radius < GOAL_RIGHT;

                if (withinPosts) {
                    result = "GOAL!";
                    score++;
                    updateQ(currentState, currentAction, -1);
                } else {
                    result = "WIDE!";
                    updateQ(currentState, currentAction, 0);
                }

                shots++;
                resetBall();
            }
        }

        if (shots >= MAX_SHOTS) {
            finalResult = "Final Score: " + score + "/" + MAX_SHOTS;
            result = finalResult;

            gameStarted = false;
            score = 0;
            shots = 0;
        }
    },

    render() {
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameStarted) {
            context.fillStyle = "white";
            context.font = "50px Arial";
            context.fillText("TOP BINS", 280, 200);

            context.font = "25px Arial";
            context.fillText("Press ENTER to Play", 270, 300);

            if (finalResult) {
                context.font = "30px Arial";
                context.fillText(finalResult, 230, 400);
            }
            return;
        }

        context.fillStyle = "white";
        context.font = "30px Arial";
        context.fillText("TOP BINS", 320, 40);

        context.font = "20px Arial";
        context.fillText("← → Aim   ↑ Power   ↓ Center   SPACE Shoot", 200, 585);
        context.fillText("Score: " + score + "/" + shots, 650, 30);

        context.font = "30px Arial";
        context.fillText(result, 330, 200);

        context.fillStyle = "white";
        context.fillRect(GOAL_LEFT, GOAL_Y, GOAL_RIGHT - GOAL_LEFT, 20);

        context.fillStyle = goalie.direction === 0 ? "yellow" : "red";
        context.fillRect(goalie.x, goalie.y, goalie.width, goalie.height);

        context.beginPath();
        context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        context.fillStyle = "black";
        context.fill();

        // AIM + POWER VISUALS (RESTORED)
        if (!ball.moving) {
            const rad = (aimAngle * Math.PI) / 180;
            const len = 40;

            context.beginPath();
            context.moveTo(ball.x, ball.y);
            context.lineTo(ball.x + Math.sin(rad)*len, ball.y - Math.cos(rad)*len);
            context.strokeStyle = "white";
            context.stroke();

            context.fillStyle = "white";
            context.fillText("Power: " + power.toFixed(1), 20, 560);
        }
    }
});

loop.start();