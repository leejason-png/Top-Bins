const START_X = 390;
const START_Y = 500;
const SHOT_POWER_SCALE = 0.82;

export function createBall(x, y) {
    return {
        x,
        y,
        radius: 12,
        moving: false,
        dx: 0,
        dy: 0
    };
}

export function shootBall(ball, aimAngle, power) {
    let rad = aimAngle * Math.PI / 180;
    let noise = (Math.random() - 0.5) * 0.2;
    let shotPower = power * SHOT_POWER_SCALE;

    ball.dx = Math.sin(rad + noise) * shotPower;
    ball.dy = -Math.cos(rad + noise) * shotPower;
    ball.moving = true;
}

export function updateBall(ball) {
    if (ball.moving) {
        ball.x += ball.dx;
        ball.y += ball.dy;
    }
}

export function resetBall(ball) {
    ball.x = START_X;
    ball.y = START_Y;
    ball.dx = 0;
    ball.dy = 0;
    ball.moving = false;
}
