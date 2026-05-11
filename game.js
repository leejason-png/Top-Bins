import { init, GameLoop, initKeys } from 'https://unpkg.com/kontra/kontra.mjs';
import { createBall, shootBall, updateBall, resetBall } from './ball.js';
import { createGoalie, updateGoalie } from './goalie.js';
import { generateDefenders, handleDefenderCollision } from './defenders.js';
import { getState, chooseAction, updateQ } from './qlearning.js';

let { canvas, context } = init();
initKeys();

canvas.width = 900;
canvas.height = 650;
canvas.style.background = "#2e8b57";

const GOAL_LEFT = 260;
const GOAL_RIGHT = 640;
const GOAL_Y = 64;
const SAVE_ZONE_Y = 132;
const MAX_KICKS = 5;
const START_LEVEL = 1;
const POST_SOUND_URL = "https://cdn.discordapp.com/attachments/1446573420597743698/1503431293147283548/The_Ball_hits_the_Post_sound_effect.mp3?ex=6a035300&is=6a020180&hm=18e2f25e6345d40cfa32fa1f8e37e3d7e42ba6a7009f90ef47d27ecb19af0f0f&";
const COMMENTARY = [
    "What a strike!",
    "The keeper had no chance!",
    "A nerveless penalty.",
    "Brilliant reflexes from the keeper.",
    "That clipped the frame!",
    "The crowd can barely watch."
];

let gameState = "menu";
let ball = createBall(450, 535);
let goalie = createGoalie();
let defenders = generateDefenders(START_LEVEL);
let bounceCooldown = { value: 0 };
let aimAngle = 0;
let power = 6;
let level = START_LEVEL;
let playerScore = 0;
let goalieScore = 0;
let kicksTaken = 0;
let currentState = null;
let currentAction = null;
let resultText = "";
let overlayText = "";
let overlayTimer = 0;
let flashTimer = 0;
let commentary = "Press Enter to begin.";
let commentaryTimer = 0;
let shakeTimer = 0;
let shakePower = 0;
let netRipple = 0;
let crowdMood = 0;
let crowdDrop = 0;
let tension = 0;
let lastOutcome = "";
let shotSettled = false;

let audio = null;
let crowdGain = null;
let noiseSource = null;
let postAudio = null;

const keys = { down: new Set(), pressed: new Set() };
window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (!keys.down.has(key)) keys.pressed.add(key);
    keys.down.add(key);
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "enter"].includes(key)) {
        event.preventDefault();
    }
});

window.addEventListener("keyup", event => {
    keys.down.delete(event.key.toLowerCase());
});

function takeKey(key) {
    key = key.toLowerCase();
    if (!keys.pressed.has(key)) return false;
    keys.pressed.delete(key);
    return true;
}

function keyDown(key) {
    return keys.down.has(key.toLowerCase());
}

function ensureAudio() {
    if (audio) {
        if (audio.state === "suspended") audio.resume();
        return;
    }

    audio = new (window.AudioContext || window.webkitAudioContext)();
    crowdGain = audio.createGain();
    crowdGain.gain.value = 0.03;
    crowdGain.connect(audio.destination);

    const bufferSize = audio.sampleRate * 2;
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.9;
    filter.connect(crowdGain);

    noiseSource = audio.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;
    noiseSource.connect(filter);
    noiseSource.start();

    postAudio = new Audio(POST_SOUND_URL);
    postAudio.preload = "auto";
    postAudio.volume = 0.85;
    postAudio.load();
}

function playTone(type, frequency, duration, gainValue) {
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
}

function playNoise(duration, gainValue, frequency) {
    if (!audio) return;
    const bufferSize = Math.max(1, Math.floor(audio.sampleRate * duration));
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start();
}

function kickSound() {
    playTone("triangle", 86, 0.11, 0.35);
    playNoise(0.06, 0.22, 140);
}

function netSound() {
    playNoise(0.45, 0.12, 1750);
}

function generatedPostSound() {
    playTone("square", 520, 0.28, 0.25);
    playTone("sine", 900, 0.16, 0.12);
}

function postSound() {
    if (!postAudio) {
        generatedPostSound();
        return;
    }

    const sound = postAudio.cloneNode();
    sound.volume = postAudio.volume;
    const played = sound.play();
    if (played && typeof played.catch === "function") {
        played.catch(() => generatedPostSound());
    }
}

function saveSound() {
    playNoise(0.2, 0.18, 260);
}

function startGame() {
    ensureAudio();
    gameState = "playing";
    playerScore = 0;
    goalieScore = 0;
    kicksTaken = 0;
    level = START_LEVEL;
    defenders = generateDefenders(level);
    commentary = "The first taker steps up.";
    commentaryTimer = 160;
    resetKick();
}

function resetKick() {
    resetBall(ball);
    ball.x = 450;
    ball.y = 535;
    goalie = createGoalie();
    goalie.x = 400;
    goalie.y = 82;
    goalie.width = 100;
    goalie.height = 22;
    goalie.direction = Math.random() < 0.5 ? -1 : 1;
    aimAngle = 0;
    power = 6;
    currentState = null;
    currentAction = null;
    shotSettled = false;
    tension = 0;
}

function finishKick(outcome) {
    if (shotSettled) return;
    shotSettled = true;
    kicksTaken++;
    lastOutcome = outcome;

    if (outcome === "goal") {
        playerScore++;
        overlayText = "GOAL!";
        updateQ(currentState, currentAction, -1);
        flashTimer = 24;
        netRipple = 32;
        crowdMood = 1;
        crowdDrop = 0;
        netSound();
    } else {
        goalieScore++;
        overlayText = outcome === "saved" ? "SAVED!" : outcome === "post" ? "POST!" : "MISSED!";
        updateQ(currentState, currentAction, +1);
        flashTimer = outcome === "post" ? 12 : 9;
        crowdMood = 0;
        crowdDrop = 1;
        if (outcome === "saved") saveSound();
        if (outcome === "post") postSound();
    }

    overlayTimer = 95;
    commentary = randomCommentary(outcome);
    commentaryTimer = 180;
    ball.moving = false;
    gameState = isShootoutOver() ? "result" : "between";
    resultText = getResultText();
}

function randomCommentary(outcome) {
    if (outcome === "goal") return COMMENTARY[Math.floor(Math.random() * 3)];
    if (outcome === "saved") return COMMENTARY[3];
    if (outcome === "post") return COMMENTARY[4];
    return COMMENTARY[5];
}

function isShootoutOver() {
    return kicksTaken >= MAX_KICKS;
}

function getResultText() {
    if (!isShootoutOver()) return "";
    if (playerScore > goalieScore) return "YOU WIN";
    if (playerScore < goalieScore) return "KEEPER WINS";
    return "DRAW";
}

function continueAfterKick() {
    if (gameState === "result") {
        startGame();
        return;
    }
    gameState = "playing";
    if (lastOutcome === "goal") level++;
    defenders = generateDefenders(Math.min(level, 5));
    resetKick();
}

function shoot() {
    ensureAudio();
    if (ball.moving) return;
    shootBall(ball, aimAngle, power);
    currentState = getState(ball.x, ball.dx, GOAL_LEFT);
    currentAction = chooseAction(currentState);
    if (currentAction === 0) currentAction = Math.random() < 0.5 ? -1 : 1;
    goalie.direction = currentAction;
    shakeTimer = Math.floor(power * 2);
    shakePower = Math.max(2, power / 2);
    kickSound();
}

function updateGame() {
    if (audio && crowdGain) {
        const targetCrowd = 0.025 + tension * 0.045 + crowdMood * 0.08;
        crowdGain.gain.setTargetAtTime(targetCrowd, audio.currentTime, 0.08);
    }

    if (takeKey("enter")) {
        if (gameState === "menu") startGame();
        else if (gameState === "between" || gameState === "result") continueAfterKick();
    }

    if (overlayTimer > 0) overlayTimer--;
    if (flashTimer > 0) flashTimer--;
    if (commentaryTimer > 0) commentaryTimer--;
    if (shakeTimer > 0) shakeTimer--;
    if (netRipple > 0) netRipple--;
    crowdMood *= 0.96;
    crowdDrop *= 0.94;

    if (gameState !== "playing") return;

    if (!ball.moving) {
        tension = Math.min(1, tension + 0.006);
        if (keyDown("arrowleft")) aimAngle = Math.max(-45, aimAngle - 1.6);
        if (keyDown("arrowright")) aimAngle = Math.min(45, aimAngle + 1.6);
        if (takeKey("arrowdown")) aimAngle = 0;
        if (keyDown("arrowup")) power = Math.min(12.5, power + 0.08);
        if (keyDown("arrowdown")) power = Math.max(4, power - 0.08);
        if (takeKey(" ")) shoot();
    } else {
        updateBall(ball);
        ball.dy *= 0.996;
        ball.dx += Math.sin(kicksTaken + ball.y * 0.02) * 0.012;
        updateGoalie(goalie, ball, currentAction, GOAL_LEFT, GOAL_RIGHT);
        handleDefenderCollision(ball, defenders, bounceCooldown);
        checkOutcome();
    }
}

function checkOutcome() {
    const hitGoalie = ball.y < SAVE_ZONE_Y &&
        ball.x > goalie.x - ball.radius &&
        ball.x < goalie.x + goalie.width + ball.radius;

    if (hitGoalie) {
        finishKick("saved");
        return;
    }

    const hitLeftPost = Math.abs(ball.x - GOAL_LEFT) < ball.radius + 4 && ball.y <= GOAL_Y + 24;
    const hitRightPost = Math.abs(ball.x - GOAL_RIGHT) < ball.radius + 4 && ball.y <= GOAL_Y + 24;
    const hitCrossbar = ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT && Math.abs(ball.y - GOAL_Y) < ball.radius + 5;

    if (hitLeftPost || hitRightPost || hitCrossbar) {
        ball.dx *= -0.45;
        ball.dy *= -0.35;
        if (Math.random() < 0.35) {
            postSound();
            finishKick("goal");
        } else {
            finishKick("post");
        }
        return;
    }

    if (ball.y <= GOAL_Y) {
        finishKick(ball.x > GOAL_LEFT && ball.x < GOAL_RIGHT ? "goal" : "miss");
        return;
    }

    if (ball.x < -30 || ball.x > canvas.width + 30 || ball.y < -30 || ball.y > canvas.height + 40) {
        finishKick("miss");
    }
}

function drawPitch() {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#194f35");
    gradient.addColorStop(1, "#257a43");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 10; i++) {
        context.fillStyle = i % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.045)";
        context.fillRect(i * canvas.width / 10, 150, canvas.width / 10, canvas.height);
    }

    context.strokeStyle = "rgba(255,255,255,0.8)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(160, 64);
    context.lineTo(740, 64);
    context.stroke();
    context.strokeRect(190, 64, 520, 185);
    context.strokeRect(315, 64, 270, 82);
    context.beginPath();
    context.arc(450, 535, 5, 0, Math.PI * 2);
    context.fillStyle = "rgba(255,255,255,0.9)";
    context.fill();
}

function drawCrowd() {
    context.fillStyle = "#111719";
    context.fillRect(0, 0, canvas.width, 72);
    for (let i = 0; i < 78; i++) {
        const x = i * 12 - 4;
        const bounce = Math.sin(performance.now() * 0.004 + i) * 2 * crowdMood;
        const drop = crowdDrop * 6;
        const y = 42 + (i % 5) * 4 + drop - bounce;
        context.fillStyle = i % 3 ? "#263036" : "#334047";
        context.beginPath();
        context.arc(x, y, 4, 0, Math.PI * 2);
        context.fill();
        context.fillRect(x - 3, y + 4, 7, 14);
        if (crowdMood > 0.15) {
            context.strokeStyle = "#d9e2df";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(x - 3, y + 7);
            context.lineTo(x - 7, y - 7 - bounce);
            context.moveTo(x + 3, y + 7);
            context.lineTo(x + 7, y - 8 - bounce);
            context.stroke();
        }
    }
}

function drawLights() {
    for (const x of [90, 810]) {
        const beam = context.createRadialGradient(x, 8, 4, x, 8, 420);
        beam.addColorStop(0, "rgba(255,255,220,0.5)");
        beam.addColorStop(1, "rgba(255,255,220,0)");
        context.fillStyle = beam;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#fbffe3";
        for (let i = 0; i < 5; i++) context.fillRect(x - 35 + i * 17, 10, 10, 8);
    }
}

function drawGoal() {
    context.save();
    context.strokeStyle = "rgba(255,255,255,0.28)";
    context.lineWidth = 1;
    for (let x = GOAL_LEFT; x <= GOAL_RIGHT; x += 18) {
        const wave = Math.sin((x + netRipple * 9) * 0.05) * netRipple * 0.4;
        context.beginPath();
        context.moveTo(x, GOAL_Y);
        context.lineTo(x + wave, GOAL_Y + 90);
        context.stroke();
    }
    for (let y = GOAL_Y; y <= GOAL_Y + 90; y += 15) {
        context.beginPath();
        context.moveTo(GOAL_LEFT, y);
        context.lineTo(GOAL_RIGHT, y + Math.sin(netRipple * 0.3) * netRipple * 0.2);
        context.stroke();
    }
    context.strokeStyle = "#f4f7f5";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(GOAL_LEFT, GOAL_Y + 92);
    context.lineTo(GOAL_LEFT, GOAL_Y);
    context.lineTo(GOAL_RIGHT, GOAL_Y);
    context.lineTo(GOAL_RIGHT, GOAL_Y + 92);
    context.stroke();
    context.restore();
}

function drawDefenders() {
    defenders.forEach(d => {
        context.save();
        context.translate(d.x + d.width / 2, d.y + d.height / 2);
        context.rotate(d.angle * Math.PI / 180);
        context.fillStyle = "#143c8f";
        context.fillRect(-d.width / 2, -d.height / 2, d.width, d.height);
        context.fillStyle = "#f0c9a0";
        context.beginPath();
        context.arc(0, -d.height / 2 - 8, 8, 0, Math.PI * 2);
        context.fill();
        context.restore();
    });
}

function drawGoalie() {
    const t = performance.now() * 0.006;
    const breathe = Math.sin(t) * 2;
    const lean = ball.moving ? goalie.direction * 0.25 : 0;
    context.save();
    context.translate(goalie.x + goalie.width / 2, goalie.y + goalie.height / 2 + breathe);
    context.rotate(lean);
    context.fillStyle = "#d7192c";
    context.fillRect(-goalie.width / 2, -goalie.height / 2, goalie.width, goalie.height);
    context.fillStyle = "#ffe0b6";
    context.beginPath();
    context.arc(0, -18, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#ffd2a3";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(-goalie.width / 2 + 10, 0);
    context.lineTo(-goalie.width / 2 - 18, ball.moving ? goalie.direction * 7 : 5);
    context.moveTo(goalie.width / 2 - 10, 0);
    context.lineTo(goalie.width / 2 + 18, ball.moving ? goalie.direction * 7 : 5);
    context.stroke();
    context.restore();
}

function drawBall() {
    if (ball.moving) {
        for (let i = 5; i > 0; i--) {
            context.globalAlpha = 0.08 * i;
            context.beginPath();
            context.arc(ball.x - ball.dx * i * 0.85, ball.y - ball.dy * i * 0.85, ball.radius * (1 - i * 0.04), 0, Math.PI * 2);
            context.fillStyle = "#ffffff";
            context.fill();
        }
        context.globalAlpha = 1;
    }

    const spin = performance.now() * 0.01 + ball.x * 0.03;
    context.save();
    context.translate(ball.x, ball.y);
    context.rotate(spin);
    context.fillStyle = "#f8f8f0";
    context.beginPath();
    context.arc(0, 0, ball.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#151515";
    for (let i = 0; i < 5; i++) {
        context.rotate(Math.PI * 0.4);
        context.fillRect(2, -2, ball.radius - 3, 4);
    }
    context.restore();
}

function drawAim() {
    if (gameState !== "playing" || ball.moving) return;
    const rad = aimAngle * Math.PI / 180;
    const length = 45 + power * 8;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(ball.x, ball.y);
    context.quadraticCurveTo(
        ball.x + Math.sin(rad) * length * 0.4,
        ball.y - length * 0.7,
        ball.x + Math.sin(rad) * length,
        ball.y - Math.cos(rad) * length
    );
    context.stroke();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(ball.x + Math.sin(rad) * length, ball.y - Math.cos(rad) * length, 5, 0, Math.PI * 2);
    context.fill();
}

function drawScoreboard() {
    context.fillStyle = "rgba(4,12,10,0.72)";
    context.fillRect(18, 86, 310, 82);
    context.strokeStyle = "rgba(255,255,255,0.2)";
    context.strokeRect(18, 86, 310, 82);
    context.fillStyle = "#f8fff9";
    context.font = "bold 20px Arial";
    context.fillText("TOP BINS SHOOTOUT", 34, 112);
    context.font = "16px Arial";
    context.fillText(`Kicks: ${Math.min(kicksTaken, MAX_KICKS)}/${MAX_KICKS}`, 34, 138);
    context.fillText(`Player ${playerScore} - ${goalieScore} Goalie`, 170, 138);
    context.fillText(`Level: ${level}  Current: Player vs Adaptive Keeper`, 34, 158);
}

function drawTextScreens() {
    if (gameState === "menu") {
        drawCenteredPanel("TOP BINS", "Press Enter to start", "Arrow keys aim and set power. Space shoots.");
    } else if (gameState === "between") {
        drawCenteredPanel(overlayText, "Press Enter for next kick", commentary);
    } else if (gameState === "result") {
        drawCenteredPanel(resultText, "Press Enter to restart", `Final: Player ${playerScore} - ${goalieScore} Goalie`);
    }
}

function drawCenteredPanel(title, line1, line2) {
    context.fillStyle = "rgba(0,0,0,0.55)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.font = "bold 68px Arial";
    context.fillText(title, canvas.width / 2, 260);
    context.font = "24px Arial";
    context.fillText(line1, canvas.width / 2, 320);
    context.font = "18px Arial";
    context.fillText(line2, canvas.width / 2, 356);
    context.textAlign = "left";
}

function drawOverlays() {
    if (overlayTimer > 0 && gameState === "playing") {
        const scale = 1 + (95 - overlayTimer) * 0.006;
        context.save();
        context.globalAlpha = Math.min(1, overlayTimer / 18);
        context.translate(canvas.width / 2, 260);
        context.scale(scale, scale);
        context.fillStyle = overlayText === "GOAL!" ? "#fff06c" : "#ffffff";
        context.textAlign = "center";
        context.font = "bold 72px Arial";
        context.fillText(overlayText, 0, 0);
        context.restore();
        context.textAlign = "left";
    }

    if (commentaryTimer > 0 && gameState === "playing") {
        context.fillStyle = "rgba(0,0,0,0.5)";
        context.fillRect(300, 586, 300, 34);
        context.fillStyle = "#ffffff";
        context.font = "17px Arial";
        context.textAlign = "center";
        context.fillText(commentary, 450, 609);
        context.textAlign = "left";
    }

    if (flashTimer > 0) {
        context.fillStyle = `rgba(255,255,255,${flashTimer / 55})`;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawPowerHud() {
    if (gameState !== "playing") return;
    context.fillStyle = "rgba(0,0,0,0.42)";
    context.fillRect(724, 98, 136, 72);
    context.fillStyle = "#ffffff";
    context.font = "15px Arial";
    context.fillText(`Angle ${aimAngle.toFixed(0)}°`, 740, 124);
    context.fillText(`Power ${power.toFixed(1)}`, 740, 148);
    context.fillStyle = "#f7d34d";
    context.fillRect(740, 156, Math.min(100, power * 8), 6);
}

function renderGame() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const zoom = gameState === "playing" && !ball.moving ? 1 + tension * 0.035 : 1;
    const shakeX = shakeTimer > 0 ? (Math.random() - 0.5) * shakePower : 0;
    const shakeY = shakeTimer > 0 ? (Math.random() - 0.5) * shakePower : 0;
    context.save();
    context.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
    context.scale(zoom, zoom);
    context.translate(-canvas.width / 2, -canvas.height / 2);
    drawPitch();
    drawCrowd();
    drawLights();
    drawGoal();
    drawDefenders();
    drawGoalie();
    drawAim();
    drawBall();
    context.restore();

    drawScoreboard();
    drawPowerHud();
    drawOverlays();
    drawTextScreens();
}

let loop = GameLoop({
    update() {
        updateGame();
    },
    render() {
        renderGame();
    }
});

loop.start();
