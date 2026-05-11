export function generateDefenders(level) {
    if (level === 1) {
        return [{ x: 550, y: 250, width: 20, height: 100, angle: 0 }];
    } else if (level === 2) {
        return [
            { x: 280, y: 300, width: 120, height: 20, angle: 15 },
            { x: 400, y: 200, width: 120, height: 20, angle: 30 }
        ];
    } else {
        return [
            { x: 250, y: 320, width: 120, height: 20, angle: 25 },
            { x: 420, y: 260, width: 120, height: 20, angle: -25 },
            { x: 330, y: 180, width: 120, height: 20, angle: 15 }
        ];
    }
}

export function handleDefenderCollision(ball, defenders, bounceCooldownRef) {
    let bounceCooldown = bounceCooldownRef.value;

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

        if (
            Math.abs(localX) < d.width / 2 &&
            Math.abs(localY) < d.height / 2 &&
            bounceCooldown === 0
        ) {
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

            bounceCooldownRef.value = 10;
        }
    }

    if (bounceCooldownRef.value > 0) bounceCooldownRef.value--;
}