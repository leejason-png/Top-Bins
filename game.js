import { init, GameLoop, keyPressed, initKeys } from 'https://unpkg.com/kontra/kontra.mjs';

let { canvas, context } = init();
initKeys();

canvas.width = 800;
canvas.height = 600;
canvas.style.background = "#2e8b57";

// Q LEARNING
let Q = {};
const ACTIONS = [-1, 0, 1];
let EPSILON = 0.3;
const ALPHA = 0.05;

// CONSTANTS
const GOAL_LEFT = 250;
const GOAL_RIGHT = 550;
const GOAL_Y = 50;
const SAVE_ZONE_Y = 120;
const BALL_START_X = 390;
const BALL_START_Y = 500;

// GAME STATE
let gameStarted = false;
let result = "";
let level = 1;
let shotsLeft = 3;
let aimAngle = 0;
let power = 6;
let currentState = null;
let currentAction = null;

// DIVE SYSTEM
let diveTimer = 0;

// BALL
let ball = {
    x: BALL_START_X,
    y: BALL_START_Y,
    radius: 12,
    moving: false,
    dx: 0,
    dy: 0
};

// GOALIE
let goalie = {
    x: 350,
    y: 70,
    width: 100,
    height: 20,
    speed: 3,
    direction: 1,
    baseY: 70
};

// DEFENDERS
let defenders = [];
let bounceCooldown = 0;

// Q HELPERS
function getState(x, dx) {
    let bucket = Math.floor((x - GOAL_LEFT) / 60);
    bucket = Math.max(0, Math.min(4, bucket));
    let dir = dx < -1 ? -1 : dx > 1 ? 1 : 0;
    return `${bucket}_${dir}`;
}

function chooseAction(state) {
    if (!Q[state]) Q[state] = { "-1": 0, "0": 0, "1": 0 };

    if (Math.random() < EPSILON) {
        return ACTIONS[Math.floor(Math.random() * 3)];
    }

    return parseInt(Object.entries(Q[state]).reduce((a, b) => b[1] > a[1] ? b : a)[0]);
}

function updateQ(state, action, reward) {
    if (!Q[state]) Q[state] = { "-1": 0, "0": 0, "1": 0 };
    Q[state][action] += ALPHA * (reward - Q[state][action]);
}

// LEVELS
function generateDefenders() {
    if (level === 1) {
        defenders = [{ x: 550, y: 250, width: 20, height: 100, angle: 0 }];
    } else if (level === 2) {
        defenders = [
            { x: 280, y: 300, width: 120, height: 20, angle: 15 },
            { x: 400, y: 200, width: 120, height: 20, angle: 30 }
        ];
    } else {
        defenders = [
            { x: 250, y: 320, width: 120, height: 20, angle: 25 },
            { x: 420, y: 260, width: 120, height: 20, angle: -25 },
            { x: 330, y: 180, width: 120, height: 20, angle: 15 }
        ];
    }
}

function applyLevelDifficulty() {
    goalie.speed = 2 + level * 0.5;
    EPSILON = Math.max(0.05, 0.4 - level * 0.03);
}

// RESET
function resetBall() {
    ball.x = BALL_START_X;
    ball.y = BALL_START_Y;
    ball.moving = false;
    ball.dx = 0;
    ball.dy = 0;
    power = 6;

    goalie.x = 350;
    goalie.y = goalie.baseY;
    goalie.direction = Math.random() < 0.5 ? -1 : 1;

    diveTimer = 0;
    bounceCooldown = 0;
}

// GAME LOOP
let loop = GameLoop({
    update() {

        // START
        if (!gameStarted && keyPressed("enter")) {
            applyLevelDifficulty();
            generateDefenders();
            shotsLeft = 3;
            result = "";
            gameStarted = true;
        }

        if (!gameStarted) return;

        // AIM
        if (!ball.moving) {
            if (keyPressed("arrowleft")) aimAngle = Math.max(-45, aimAngle - 2);
            if (keyPressed("arrowright")) aimAngle = Math.min(45, aimAngle + 2);
            if (keyPressed("arrowdown")) aimAngle = 0;

            if (keyPressed("arrowup")) power = Math.min(12, power + 0.1);
            else power = Math.max(4, power - 0.1);
        }

        // SHOOT
        if (!ball.moving && keyPressed("space")) {
            ball.moving = true;

            let rad = aimAngle * Math.PI / 180;
            let noise = (Math.random() - 0.5) * 0.2;

            ball.dx = Math.sin(rad + noise) * power;
            ball.dy = -Math.cos(rad + noise) * power;

            currentState = getState(ball.x, ball.dx);
            currentAction = chooseAction(currentState);

            if (currentAction === 0) {
                currentAction = Math.random() < 0.5 ? -1 : 1;
            }

            goalie.direction = currentAction;
            diveTimer = 18; // ← dive duration
        }

        // MOVE BALL
        if (ball.moving) {
            ball.x += ball.dx;
            ball.y += ball.dy;
        }

        // GOALIE MOVEMENT
        if (!ball.moving) {
            // patrol
            goalie.x += goalie.direction * goalie.speed;

            if (goalie.x <= GOAL_LEFT) goalie.direction = 1;
            if (goalie.x + goalie.width >= GOAL_RIGHT) goalie.direction = -1;

            goalie.y = goalie.baseY;
        }
        else {
            if (diveTimer > 0) {
                // DIVE (fast + forward motion)
                goalie.x += currentAction * (goalie.speed * 3);
                goalie.y += 1.2; // forward motion
                diveTimer--;
            }
            else {
                // recovery (snap back)
                goalie.y += (goalie.baseY - goalie.y) * 0.2;
            }
        }

        // clamp
        goalie.x = Math.max(GOAL_LEFT, Math.min(goalie.x, GOAL_RIGHT - goalie.width));

        // DEFENDER COLLISION (UNCHANGED)
        for (let d of defenders) {
            let cx = d.x + d.width / 2;
            let cy = d.y + d.height / 2;
            let angle = d.angle * Math.PI / 180;

            let cos = Math.cos(-angle);
            let sin = Math.sin(-angle);

            let relX = ball.x - cx;
            let relY = ball.y - cy;

            let localX = relX * cos - relY * sin;
            let localY = relX * sin + relY * cos;

            if (Math.abs(localX) < d.width / 2 &&
                Math.abs(localY) < d.height / 2 &&
                bounceCooldown === 0) {

                let overlapX = d.width / 2 - Math.abs(localX);
                let overlapY = d.height / 2 - Math.abs(localY);

                let nx = 0, ny = 0;

                if (overlapX < overlapY) {
                    nx = localX > 0 ? 1 : -1;
                } else {
                    ny = localY > 0 ? 1 : -1;
                }

                let cosA = Math.cos(angle);
                let sinA = Math.sin(angle);

                let worldNX = nx * cosA - ny * sinA;
                let worldNY = nx * sinA + ny * cosA;

                let dot = ball.dx * worldNX + ball.dy * worldNY;

                ball.dx -= 2 * dot * worldNX;
                ball.dy -= 2 * dot * worldNY;

                bounceCooldown = 10;
            }
        }

        if (bounceCooldown > 0) bounceCooldown--;

        // GOALIE HIT
        let hitGoalie =
            ball.y < SAVE_ZONE_Y &&
            ball.x > goalie.x &&
            ball.x < goalie.x + goalie.width;

        if (hitGoalie) {
            result = "SAVED!";
            updateQ(currentState, currentAction, +1);
            shotsLeft--;
            resetBall();
        }

        // GOAL
        else if (ball.y <= GOAL_Y) {
            let goal = ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT;

            if (goal) {
                result = "LEVEL UP!";
                updateQ(currentState, currentAction, -1);
                level++;
                gameStarted = false;
            } else {
                result = "MISS";
            }

            shotsLeft--;
            resetBall();
        }

        // OUT
        if (ball.y > canvas.height) {
            result = "MISS";
            shotsLeft--;
            resetBall();
        }

        // FAIL
        if (shotsLeft <= 0 && gameStarted) {
            result = "FAILED";
            gameStarted = false;
        }
    },

    render() {
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameStarted) {
            context.fillStyle = "white";
            context.font = "40px Arial";
            context.fillText("TOP BINS", 300, 200);
            context.fillText(result, 300, 300);
            context.fillText("Press ENTER", 280, 400);
            return;
        }

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

        // AIM
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