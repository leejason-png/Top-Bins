export function generateDefenders(level) {
    if (level === 1) {
        return [{ x: 550, y: 250, width: 20, height: 100, angle: 0 }];
    }

    if (level === 2) {
        return [
            { x: 280, y: 300, width: 120, height: 20, angle: 15 },
            { x: 400, y: 200, width: 120, height: 20, angle: 30 }
        ];
    }

    if (level === 3) {
        return [
            { x: 250, y: 320, width: 120, height: 20, angle: 25 },
            { x: 420, y: 260, width: 120, height: 20, angle: -25 },
            { x: 330, y: 180, width: 120, height: 20, angle: 15 }
        ];
    }

    if (level === 4) {
        return [
            { x: 210, y: 340, width: 145, height: 20, angle: 18 },
            { x: 455, y: 340, width: 145, height: 20, angle: -18 },
            { x: 305, y: 250, width: 120, height: 20, angle: -32 },
            { x: 430, y: 190, width: 115, height: 20, angle: 26 }
        ];
    }

    return [
        { x: 185, y: 365, width: 155, height: 20, angle: 16 },
        { x: 465, y: 365, width: 155, height: 20, angle: -16 },
        { x: 275, y: 285, width: 135, height: 20, angle: -30 },
        { x: 430, y: 255, width: 135, height: 20, angle: 30 },
        { x: 345, y: 175, width: 130, height: 20, angle: 0 }
    ];
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
