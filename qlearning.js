export let Q = {};
export const ACTIONS = [-1, 0, 1];
export let EPSILON = 0.3;
export const ALPHA = 0.05;

export function getState(x, dx, GOAL_LEFT) {
    let bucket = Math.floor((x - GOAL_LEFT) / 60);
    bucket = Math.max(0, Math.min(4, bucket));
    let dir = dx < -1 ? -1 : dx > 1 ? 1 : 0;
    return `${bucket}_${dir}`;
}

export function chooseAction(state) {
    if (!Q[state]) Q[state] = { "-1": 0, "0": 0, "1": 0 };

    if (Math.random() < EPSILON) {
        return ACTIONS[Math.floor(Math.random() * 3)];
    }

    return parseInt(
        Object.entries(Q[state]).reduce((a, b) => (b[1] > a[1] ? b : a))[0]
    );
}

export function updateQ(state, action, reward) {
    if (!Q[state]) Q[state] = { "-1": 0, "0": 0, "1": 0 };
    Q[state][action] += ALPHA * (reward - Q[state][action]);
}