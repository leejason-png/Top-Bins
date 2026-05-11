export function createGoalie() {
    return {
        x: 350,
        y: 70,
        width: 100,
        height: 20,
        speed: 3,
        direction: 1
    };
}

export function updateGoalie(goalie, ball, currentAction, GOAL_LEFT, GOAL_RIGHT) {
    if (!ball.moving) {
        goalie.x += goalie.direction * goalie.speed;

        if (goalie.x <= GOAL_LEFT) goalie.direction = 1;
        if (goalie.x + goalie.width >= GOAL_RIGHT) goalie.direction = -1;
    } else if (currentAction !== null) {
        goalie.x += currentAction * (goalie.speed * 3);
    }

    goalie.x = Math.max(GOAL_LEFT, Math.min(goalie.x, GOAL_RIGHT - goalie.width));
}