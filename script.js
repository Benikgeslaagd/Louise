"use strict";

// Zet je eigen foto's naast deze bestanden en geef ze dezelfde namen.
// gezicht1.png wordt als Louise-hoofd gebruikt; de rest heeft nette fallbacks.
const ASSET_FILES = {
  player: "speler.png",
  face: "gezicht1.png",
  cookie: "koek.png",
  chocolate: "chocolade.png",
  seafood: "zeevruchten.png",
  music: "one-last-time.mp3"
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("scoreText");
const highScoreText = document.getElementById("highScoreText");
const livesText = document.getElementById("livesText");
const lifeBarFill = document.getElementById("lifeBarFill");
const powerupText = document.getElementById("powerupText");
const statusText = document.getElementById("statusText");
const musicButton = document.getElementById("musicButton");
const pauseButton = document.getElementById("pauseButton");
const startOverlay = document.getElementById("startOverlay");
const howOverlay = document.getElementById("howOverlay");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownText = document.getElementById("countdownText");
const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverText = document.getElementById("gameOverText");
const finalScoreText = document.getElementById("finalScoreText");
const finalHighScoreText = document.getElementById("finalHighScoreText");
const recordText = document.getElementById("recordText");

const MAPS = {
  stad: {
    skyTop: "#82d8ff",
    skyBottom: "#ffd6ea",
    groundTop: "#b9935d",
    groundBottom: "#7f5c39",
    lane: "#fff8d6",
    glow: "#8bd3ff"
  },
  strand: {
    skyTop: "#70d6ff",
    skyBottom: "#ffe8b8",
    groundTop: "#e5bc72",
    groundBottom: "#b78345",
    lane: "#ffffff",
    glow: "#ffe66d"
  },
  snoep: {
    skyTop: "#cdb8ff",
    skyBottom: "#ffd6ea",
    groundTop: "#ba7bed",
    groundBottom: "#6c42a3",
    lane: "#7be7c7",
    glow: "#ff8cc6"
  }
};

const DIFFICULTIES = {
  easy: { label: "Easy", speed: 0.86, spawnMin: 1.65, spawnMax: 2.55, score: 0.86 },
  normal: { label: "Normal", speed: 1, spawnMin: 1.2, spawnMax: 2.1, score: 1 },
  hard: { label: "Hard", speed: 1.13, spawnMin: 0.95, spawnMax: 1.7, score: 1.12 }
};

const images = {};
const keys = new Set();
const activePointers = new Map();
let width = 900;
let height = 580;
let dpr = 1;
let lastTime = 0;
let state = "menu";
let selectedMap = "stad";
let selectedDifficulty = "normal";
let highScore = Number(localStorage.getItem("louiseHighScore") || localStorage.getItem("kaasChaosHighScore") || 0);
let muted = localStorage.getItem("louiseMuted") === "true";
let audioContext = null;
let musicAudio = null;
let musicFailed = false;
let countdownToken = 0;

let spawnTimer = 0;
let coinTimer = 0;
let powerupTimer = 30;
let shootCooldown = 0;
let shake = 0;
let popups = [];
let sparks = [];
let lastWallType = "";

const game = {
  score: 0,
  time: 0,
  crashes: 0,
  combo: 0,
  pickups: 0,
  newRecord: false,
  player: {
    x: 0,
    y: 0,
    r: 28,
    vy: 0,
    onGround: true,
    ducking: false,
    invincible: 0,
    shieldTime: 0,
    magnetTime: 0,
    speedTime: 0,
    fireFlash: 0,
    jumpSquash: 0
  },
  enemies: [],
  coins: [],
  powerups: [],
  projectiles: []
};

function loadImage(src) {
  const img = new Image();
  img.loaded = false;
  img.onerror = () => {
    img.loaded = false;
  };
  img.onload = () => {
    img.loaded = true;
  };
  img.src = src;
  return img;
}

function loadAssets() {
  images.player = loadImage(ASSET_FILES.player);
  images.face = loadImage(ASSET_FILES.face);
  images.cookie = loadImage(ASSET_FILES.cookie);
  images.chocolate = loadImage(ASSET_FILES.chocolate);
  images.seafood = loadImage(ASSET_FILES.seafood);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clampPlayer();
}

function getGroundY() {
  const mobileSpace = width < 760 ? 126 : 58;
  return Math.min(height - mobileSpace, Math.max(305, height * (width < 760 ? 0.71 : 0.78)));
}

function getRunnerHeadY() {
  return getGroundY() - game.player.r * 2.18;
}

function clampPlayer() {
  const p = game.player;
  p.x = Math.max(92, Math.min(width * 0.32, p.x || width * 0.23));
  p.y = Math.min(getRunnerHeadY(), Math.max(80, p.y || getRunnerHeadY()));
}

function resetGame() {
  const p = game.player;
  game.score = 0;
  game.time = 0;
  game.crashes = 0;
  game.combo = 0;
  game.pickups = 0;
  game.newRecord = false;
  game.enemies = [];
  game.coins = [];
  game.powerups = [];
  game.projectiles = [];
  popups = [];
  sparks = [];
  spawnTimer = 1.1;
  coinTimer = 1.4;
  powerupTimer = 30;
  shootCooldown = 0;
  shake = 0;
  lastWallType = "";
  p.r = Math.max(22, Math.min(width < 760 ? 34 : 31, width * (width < 760 ? 0.052 : 0.033)));
  p.x = Math.max(98, width * 0.23);
  p.y = getRunnerHeadY();
  p.vy = 0;
  p.onGround = true;
  p.ducking = false;
  p.invincible = 1;
  p.shieldTime = 0;
  p.magnetTime = 0;
  p.speedTime = 0;
  p.fireFlash = 0;
  p.jumpSquash = 0;
  clearControls();
  updateHud();
}

// Start altijd met een countdown, zodat mobiel en desktop dezelfde flow hebben.
function startGame() {
  resetGame();
  state = "countdown";
  startOverlay.hidden = true;
  howOverlay.hidden = true;
  pauseOverlay.hidden = true;
  gameOverOverlay.hidden = true;
  countdownOverlay.hidden = false;
  statusText.textContent = "Klaar voor Louise?";
  startMusic();
  runCountdown();
}

function runCountdown() {
  const token = ++countdownToken;
  const steps = ["3", "2", "1", "START"];
  let index = 0;

  function showStep() {
    if (token !== countdownToken || state !== "countdown") return;
    countdownText.textContent = steps[index];
    countdownText.style.animation = "none";
    countdownText.offsetHeight;
    countdownText.style.animation = "";
    playSfx(index < 3 ? "tick" : "power");
    index += 1;
    if (index < steps.length) {
      window.setTimeout(showStep, 680);
    } else {
      window.setTimeout(() => {
        if (token !== countdownToken || state !== "countdown") return;
        countdownOverlay.hidden = true;
        state = "playing";
        lastTime = performance.now();
        statusText.textContent = "Ren, spring, duik en schiet make-up.";
        startMusic();
      }, 520);
    }
  }

  showStep();
}

function pauseGame() {
  if (state !== "playing") return;
  state = "paused";
  pauseOverlay.hidden = false;
  pauseButton.textContent = "Verder";
  if (musicAudio) musicAudio.pause();
}

function resumeGame() {
  if (state !== "paused") return;
  state = "playing";
  pauseOverlay.hidden = true;
  pauseButton.textContent = "Pauze";
  lastTime = performance.now();
  startMusic();
}

function togglePause() {
  if (state === "playing") pauseGame();
  else if (state === "paused") resumeGame();
}

function endGame() {
  state = "gameover";
  countdownToken += 1;
  const oldHigh = highScore;
  game.newRecord = game.score > oldHigh;
  highScore = Math.max(highScore, game.score);
  localStorage.setItem("louiseHighScore", String(highScore));
  finalScoreText.textContent = "Score: " + game.score;
  finalHighScoreText.textContent = "Highscore: " + highScore;
  recordText.hidden = !game.newRecord;
  gameOverText.textContent = game.crashes >= 3 ? "Melody heeft Louise ingehaald." : "Probeer nog een rondje.";
  gameOverOverlay.hidden = false;
  playSfx("gameover");
  updateHud();
}

function updateHud() {
  scoreText.textContent = String(game.score);
  highScoreText.textContent = String(highScore);
  livesText.textContent = game.crashes + "/3";
  lifeBarFill.style.width = Math.max(0, ((3 - game.crashes) / 3) * 100) + "%";
  if (game.player.shieldTime > 0) {
    powerupText.textContent = "Schild " + Math.ceil(game.player.shieldTime) + "s";
  } else if (game.player.magnetTime > 0) {
    powerupText.textContent = "Magneet " + Math.ceil(game.player.magnetTime) + "s";
  } else if (game.player.speedTime > 0) {
    powerupText.textContent = "Boost " + Math.ceil(game.player.speedTime) + "s";
  } else {
    powerupText.textContent = Math.max(0, Math.ceil(powerupTimer)) + "s";
  }
  musicButton.textContent = muted ? "Sound aan" : "Mute";
  pauseButton.textContent = state === "paused" ? "Verder" : "Pauze";
}

function ensureAudioContext() {
  if (muted) return null;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;
  if (!audioContext) audioContext = new AudioEngine();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playSfx(kind) {
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio) return;
  const now = ctxAudio.currentTime;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();
  const settings = {
    jump: [560, 840, 0.13, "sine", 0.08],
    hit: [190, 72, 0.28, "sawtooth", 0.12],
    power: [520, 920, 0.2, "triangle", 0.09],
    coin: [780, 1040, 0.08, "square", 0.055],
    fire: [620, 360, 0.12, "square", 0.06],
    tick: [420, 520, 0.08, "sine", 0.04],
    gameover: [240, 58, 0.72, "sawtooth", 0.13]
  }[kind] || [440, 330, 0.12, "sine", 0.06];
  osc.type = settings[3];
  osc.frequency.setValueAtTime(settings[0], now);
  osc.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(settings[4], now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[2]);
  osc.connect(gain);
  gain.connect(ctxAudio.destination);
  osc.start(now);
  osc.stop(now + settings[2] + 0.03);
}

function startMusic() {
  if (muted || (state !== "playing" && state !== "countdown") || musicFailed) return;
  if (!musicAudio) {
    musicAudio = new Audio(ASSET_FILES.music);
    musicAudio.loop = true;
    musicAudio.volume = 0.48;
    musicAudio.addEventListener("error", () => {
      musicFailed = true;
      statusText.textContent = "Muziekbestand niet gevonden, effecten werken wel.";
    }, { once: true });
  }
  const promise = musicAudio.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {
      statusText.textContent = "Tik op het scherm of Start om muziek toe te staan.";
    });
  }
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem("louiseMuted", String(muted));
  if (muted && musicAudio) musicAudio.pause();
  if (!muted) {
    ensureAudioContext();
    startMusic();
    playSfx("power");
  }
  updateHud();
}

function getWorldSpeed() {
  const difficulty = DIFFICULTIES[selectedDifficulty];
  const scoreRamp = Math.min(150, game.score * 0.012);
  const pickupRamp = Math.min(90, game.pickups * 7);
  const speedBoost = game.player.speedTime > 0 ? 55 : 0;
  return Math.min(560, (178 + game.time * 2.6 + scoreRamp + pickupRamp + speedBoost) * difficulty.speed);
}

function nextObstacleDelay() {
  const difficulty = DIFFICULTIES[selectedDifficulty];
  const pressure = Math.min(0.32, game.score / 18000);
  return randomBetween(Math.max(0.82, difficulty.spawnMin - pressure), Math.max(1.1, difficulty.spawnMax - pressure));
}

function chooseEnemyType() {
  const catChance = Math.min(0.48, 0.22 + game.score / 10500);
  const roll = Math.random();
  if (roll < catChance) return "smallCat";

  if (lastWallType === "lowWall" && Math.random() < 0.62) return "highWall";
  if (lastWallType === "highWall" && Math.random() < 0.62) return "lowWall";

  const obstacleRoll = Math.random();
  if (obstacleRoll < 0.38) return "lowWall";
  if (obstacleRoll < 0.62) return "highWall";
  return "lava";
}

function addEnemy() {
  const type = chooseEnemyType();
  const ground = getGroundY();
  const r = game.player.r;
  const reactionLead = Math.min(width * 0.62, Math.max(140, getWorldSpeed() * 0.48));
  const base = {
    type,
    x: width + reactionLead + randomBetween(0, 90),
    passed: false,
    hit: false
  };
  if (type === "lowWall") {
    base.w = randomBetween(56, 78);
    base.h = randomBetween(r * 2.25, r * 2.85);
    base.y = ground;
  } else if (type === "highWall") {
    base.w = randomBetween(88, 126);
    base.top = 0;
    base.bottom = ground - r * 1.68;
    base.h = base.bottom;
    base.y = base.bottom;
  } else if (type === "lava") {
    base.w = randomBetween(width < 760 ? 82 : 94, width < 760 ? 112 : 138);
    base.h = 42;
    base.y = ground;
  } else {
    base.w = randomBetween(58, 76);
    base.h = randomBetween(34, 44);
    base.y = ground;
  }
  if (type === "lowWall" || type === "highWall") lastWallType = type;
  game.enemies.push(base);
}

function addCoinPattern() {
  const ground = getGroundY();
  const highArc = Math.random() < 0.42;
  const count = Math.random() < 0.55 ? 4 : 5;
  const startX = width + randomBetween(80, 190);
  const baseY = highArc ? ground - randomBetween(170, 215) : ground - randomBetween(82, 126);
  for (let i = 0; i < count; i += 1) {
    const arc = highArc ? Math.sin((i / Math.max(1, count - 1)) * Math.PI) * 46 : Math.sin(i * 0.9) * 10;
    game.coins.push({
      x: startX + i * 40,
      y: baseY - arc,
      r: 13,
      value: 15,
      bob: randomBetween(0, Math.PI * 2)
    });
  }
}

function randomPowerupType() {
  const roll = Math.random();
  if (roll < 0.34) return "cookie";
  if (roll < 0.67) return "seafood";
  return "chocolate";
}

function addPowerup() {
  const type = randomPowerupType();
  const ground = getGroundY();
  const sizes = { cookie: 34, chocolate: 38, seafood: 40 };
  game.powerups.push({
    type,
    x: width + randomBetween(110, 240),
    y: randomBetween(ground - 178, ground - 118),
    r: sizes[type],
    bob: randomBetween(0, Math.PI * 2)
  });
}

function jump() {
  if (state === "menu") {
    startGame();
    return;
  }
  if (state !== "playing" || !game.player.onGround) return;
  game.player.vy = -Math.max(680, height * 1.23);
  game.player.onGround = false;
  game.player.jumpSquash = 0.16;
  playSfx("jump");
}

function setDuck(active) {
  if (state !== "playing") return;
  game.player.ducking = active;
}

function shoot() {
  if (state === "menu") {
    startGame();
    return;
  }
  if (state !== "playing" || shootCooldown > 0) return;
  const p = game.player;
  game.projectiles.push({
    x: p.x + p.r * 1.18,
    y: p.ducking ? getGroundY() - p.r * 1.05 : p.y + p.r * 0.72,
    vx: getWorldSpeed() + 560,
    r: Math.max(8, p.r * 0.25),
    spin: 0,
    type: Math.random() < 0.5 ? "lipstick" : "blush"
  });
  p.fireFlash = 0.18;
  shootCooldown = 0.3;
  addPopup("FIRE!", p.x + p.r * 1.6, p.y, "#ff8cc6");
  playSfx("fire");
}

function update(dt) {
  if (state !== "playing") return;

  const p = game.player;
  const speed = getWorldSpeed();
  game.time += dt;
  game.score += Math.round(dt * 9 * DIFFICULTIES[selectedDifficulty].score);
  spawnTimer -= dt;
  coinTimer -= dt;
  powerupTimer -= dt;
  shootCooldown = Math.max(0, shootCooldown - dt);
  shake = Math.max(0, shake - dt * 18);
  p.invincible = Math.max(0, p.invincible - dt);
  p.shieldTime = Math.max(0, p.shieldTime - dt);
  p.magnetTime = Math.max(0, p.magnetTime - dt);
  p.speedTime = Math.max(0, p.speedTime - dt);
  p.fireFlash = Math.max(0, p.fireFlash - dt);
  p.jumpSquash = Math.max(0, p.jumpSquash - dt);
  if (!keys.has("arrowdown") && !keys.has("s") && !activePointersHas("duck")) p.ducking = false;

  const gravity = Math.max(1240, height * 2.45);
  p.vy += gravity * dt;
  p.y += p.vy * dt;
  if (p.y >= getRunnerHeadY()) {
    p.y = getRunnerHeadY();
    p.vy = 0;
    p.onGround = true;
  }
  clampPlayer();

  if (spawnTimer <= 0) {
    addEnemy();
    spawnTimer = nextObstacleDelay();
  }

  if (coinTimer <= 0 && game.coins.length < 10) {
    addCoinPattern();
    coinTimer = randomBetween(3.4, 5.4);
  }

  if (powerupTimer <= 0 && game.powerups.length === 0) {
    addPowerup();
    powerupTimer = 30;
  }

  moveObjects(speed, dt);
  collectCoins();
  collectPowerups();
  checkProjectileHits();
  checkEnemyHits();
  updatePassedEnemies();
  updateSparks(dt);
  updatePopups(dt);
  updateHud();
}

function moveObjects(speed, dt) {
  for (const enemy of game.enemies) enemy.x -= speed * dt;
  for (const coin of game.coins) {
    coin.bob += dt * 5;
    if (game.player.magnetTime > 0) pullTowardPlayer(coin, 250, dt);
    coin.x -= speed * 0.92 * dt;
  }
  for (const powerup of game.powerups) {
    powerup.bob += dt * 4;
    if (game.player.magnetTime > 0) pullTowardPlayer(powerup, 270, dt);
    powerup.x -= speed * 0.92 * dt;
  }
  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.spin += dt * 11;
  }
  game.enemies = game.enemies.filter(enemy => enemy.x > -180);
  game.coins = game.coins.filter(coin => coin.x > -80);
  game.powerups = game.powerups.filter(powerup => powerup.x > -180);
  game.projectiles = game.projectiles.filter(projectile => projectile.x < width + 100);
}

function pullTowardPlayer(item, range, dt) {
  const dx = game.player.x - item.x;
  const dy = game.player.y - item.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist < range) {
    item.x += (dx / dist) * 185 * dt;
    item.y += (dy / dist) * 185 * dt;
  }
}

function collectCoins() {
  const rect = getPlayerRect();
  for (let i = game.coins.length - 1; i >= 0; i -= 1) {
    const coin = game.coins[i];
    if (circleRectHit(coin.x, coin.y, coin.r, rect)) {
      game.score += coin.value;
      game.coins.splice(i, 1);
      addPopup("+" + coin.value, coin.x, coin.y, "#ffe66d");
      addSpark(coin.x, coin.y, "#ffe66d");
      playSfx("coin");
    }
  }
}

function collectPowerups() {
  const rect = getPlayerRect();
  for (let i = game.powerups.length - 1; i >= 0; i -= 1) {
    const item = game.powerups[i];
    if (circleRectHit(item.x, item.y, item.r * 0.75, rect)) {
      applyPowerup(item.type);
      game.score += 80;
      game.pickups += 1;
      game.powerups.splice(i, 1);
      addPopup(getPowerupLabel(item.type), item.x, item.y, getPowerupColor(item.type));
      addSpark(item.x, item.y, getPowerupColor(item.type));
      playSfx("power");
    }
  }
}

function applyPowerup(type) {
  if (type === "cookie") {
    game.player.shieldTime = 5;
    statusText.textContent = "Koek-schild: 5 seconden beschermd.";
  } else if (type === "seafood") {
    game.player.magnetTime = 8;
    statusText.textContent = "Zeevruchten-magneet trekt munten aan.";
  } else {
    game.player.speedTime = 6;
    statusText.textContent = "Milka speedboost en extra punten.";
  }
}

function checkProjectileHits() {
  for (let pIndex = game.projectiles.length - 1; pIndex >= 0; pIndex -= 1) {
    const projectile = game.projectiles[pIndex];
    for (let eIndex = game.enemies.length - 1; eIndex >= 0; eIndex -= 1) {
      const enemy = game.enemies[eIndex];
      if (enemy.type !== "smallCat") continue;
      const rect = getEnemyRect(enemy);
      if (circleRectHit(projectile.x, projectile.y, projectile.r, rect)) {
        game.projectiles.splice(pIndex, 1);
        game.enemies.splice(eIndex, 1);
        game.score += 70;
        addPopup("+70", enemy.x, enemy.y - enemy.h, "#ff8cc6");
        addSpark(projectile.x, projectile.y, "#ff8cc6");
        statusText.textContent = "Kleine kat gestopt met make-up.";
        break;
      }
    }
  }
}

function checkEnemyHits() {
  const playerRect = getPlayerRect();
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = game.enemies[i];
    if (enemy.hit) continue;
    if (!rectsOverlap(playerRect, getEnemyRect(enemy))) continue;
    enemy.hit = true;
    if (game.player.shieldTime > 0) {
      game.player.shieldTime = 0;
      game.enemies.splice(i, 1);
      addPopup("SCHILD!", game.player.x, game.player.y - 45, "#7be7c7");
      addSpark(game.player.x, game.player.y, "#7be7c7");
      playSfx("power");
      continue;
    }
    game.crashes += 1;
    game.combo = 0;
    game.player.invincible = 1.05;
    shake = 1;
    addPopup("-1", game.player.x, game.player.y - 48, "#ff5b6e");
    addSpark(game.player.x, game.player.y, "#ff5b6e");
    playSfx("hit");
    statusText.textContent = "Botsing! Melody komt dichterbij.";
    if (game.crashes >= 3) {
      endGame();
      return;
    }
  }
}

function updatePassedEnemies() {
  for (const enemy of game.enemies) {
    if (enemy.passed || enemy.x + enemy.w / 2 > game.player.x - game.player.r) continue;
    enemy.passed = true;
    game.combo += 1;
    game.score += 10;
    addPopup("+10", game.player.x + 25, game.player.y - 52, "#ffffff");
    if (game.combo > 0 && game.combo % 3 === 0) {
      game.score += 75;
      addPopup("COMBO +75", game.player.x + 45, game.player.y - 84, "#ffe66d");
      statusText.textContent = "Combo! 3 obstakels achter elkaar.";
    }
  }
}

function getPlayerRect() {
  const p = game.player;
  const ground = getGroundY();
  if (p.ducking) {
    return {
      x: p.x - p.r * 0.88,
      y: ground - p.r * 1.44,
      w: p.r * 1.76,
      h: p.r * 1.34
    };
  }
  return {
    x: p.x - p.r * 0.82,
    y: p.y - p.r * 1.02,
    w: p.r * 1.64,
    h: ground - (p.y - p.r * 1.02)
  };
}

function getEnemyRect(enemy) {
  if (enemy.type === "highWall") {
    return { x: enemy.x - enemy.w / 2 + getHighWallOffset(enemy), y: 0, w: enemy.w, h: enemy.bottom };
  }
  if (enemy.type === "lava") {
    return { x: enemy.x - enemy.w / 2, y: getGroundY() - 12, w: enemy.w, h: 26 };
  }
  if (enemy.type === "lowWall") {
    return { x: enemy.x - enemy.w / 2 + getLowWallOffset(enemy), y: enemy.y - enemy.h, w: enemy.w, h: enemy.h };
  }
  return { x: enemy.x - enemy.w / 2, y: enemy.y - enemy.h, w: enemy.w, h: enemy.h };
}

function getLowWallOffset(enemy) {
  return Math.sin(game.time * 24 + enemy.x * 0.03) * 1.4;
}

function getHighWallOffset(enemy) {
  return Math.sin(game.time * 8 + enemy.x * 0.02) * 1.6;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectHit(cx, cy, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return Math.hypot(cx - closestX, cy - closestY) < radius;
}

function addPopup(text, x, y, color) {
  popups.push({ text, x, y, color, life: 0.75, vy: -42 });
}

function updatePopups(dt) {
  for (const popup of popups) {
    popup.life -= dt;
    popup.y += popup.vy * dt;
  }
  popups = popups.filter(popup => popup.life > 0);
}

function addSpark(x, y, color) {
  for (let i = 0; i < 15; i += 1) {
    sparks.push({
      x,
      y,
      vx: randomBetween(-125, 125),
      vy: randomBetween(-155, 80),
      life: randomBetween(0.32, 0.62),
      color
    });
  }
}

function updateSparks(dt) {
  for (const spark of sparks) {
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vy += 360 * dt;
  }
  sparks = sparks.filter(spark => spark.life > 0);
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(randomBetween(-5, 5) * shake, randomBetween(-3, 3) * shake);
  drawBackground();
  drawMelody();
  drawCoins();
  drawPowerups();
  drawProjectiles();
  drawEnemies();
  drawPlayer();
  drawSparks();
  drawPopups();
  ctx.restore();
}

function drawBackground() {
  const map = MAPS[selectedMap];
  const ground = getGroundY();
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, map.skyTop);
  sky.addColorStop(1, map.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawParallaxDecor(map, ground);

  const road = ctx.createLinearGradient(0, ground, 0, height);
  road.addColorStop(0, map.groundTop);
  road.addColorStop(1, map.groundBottom);
  ctx.fillStyle = road;
  ctx.fillRect(0, ground, width, height - ground);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(0, ground - 4, width, 8);
  ctx.strokeStyle = map.lane;
  ctx.lineWidth = 5;
  ctx.setLineDash([52, 48]);
  ctx.lineDashOffset = -game.time * getWorldSpeed() * 0.42;
  ctx.beginPath();
  ctx.moveTo(0, ground + Math.min(58, (height - ground) * 0.42));
  ctx.lineTo(width, ground + Math.min(58, (height - ground) * 0.42));
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawParallaxDecor(map, ground) {
  const farOffset = (game.time * getWorldSpeed() * 0.11) % 260;
  const nearOffset = (game.time * getWorldSpeed() * 0.22) % 220;
  ctx.save();
  if (selectedMap === "stad") {
    for (let x = -farOffset - 80; x < width + 120; x += 130) {
      const h = 75 + ((x + 300) % 90);
      ctx.fillStyle = "rgba(76, 75, 119, 0.22)";
      ctx.fillRect(x, ground - h, 88, h);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let wy = ground - h + 16; wy < ground - 18; wy += 22) {
        ctx.fillRect(x + 16, wy, 12, 9);
        ctx.fillRect(x + 48, wy, 12, 9);
      }
    }
  } else if (selectedMap === "strand") {
    ctx.fillStyle = "rgba(255, 230, 109, 0.72)";
    ctx.beginPath();
    ctx.arc(width - 110, 94, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 4;
    for (let x = -nearOffset; x < width + 220; x += 110) {
      ctx.beginPath();
      ctx.moveTo(x, ground - 42);
      ctx.quadraticCurveTo(x + 28, ground - 58, x + 56, ground - 42);
      ctx.quadraticCurveTo(x + 84, ground - 26, x + 112, ground - 42);
      ctx.stroke();
    }
  } else {
    for (let x = -nearOffset - 50; x < width + 120; x += 118) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, ground - 24);
      ctx.lineTo(x, ground - 104);
      ctx.stroke();
      ctx.fillStyle = x % 2 ? "#ff8cc6" : "#7be7c7";
      ctx.beginPath();
      ctx.arc(x, ground - 122, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, ground - 122, 14, 0, Math.PI * 1.4);
      ctx.stroke();
    }
  }

  ctx.fillStyle = map.glow + "55";
  for (let x = -farOffset; x < width + 260; x += 260) {
    ctx.beginPath();
    ctx.arc(x + 40, 86 + Math.sin(game.time + x) * 18, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 98, 118, 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMelody() {
  const ground = getGroundY();
  const closeness = game.crashes * 58;
  const x = Math.max(-88, game.player.x - 235 + closeness);
  const scale = game.player.r / 28;
  ctx.save();
  ctx.translate(x, ground - 12);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(34, 8, 78, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#151515";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(6, -40, 74, 38, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-56, -48);
  ctx.bezierCurveTo(-114, -92, -104, -132, -46, -96);
  ctx.stroke();
  ctx.lineWidth = 6;
  for (const lx of [-38, -8, 28, 54]) {
    ctx.beginPath();
    ctx.moveTo(lx, -8);
    ctx.lineTo(lx - 10, 4);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(76, -66, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(52, -88);
  ctx.lineTo(58, -122);
  ctx.lineTo(78, -92);
  ctx.moveTo(91, -91);
  ctx.lineTo(113, -116);
  ctx.lineTo(107, -80);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe66d";
  ctx.beginPath();
  ctx.ellipse(64, -66, 7, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(88, -66, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(76, -54);
    ctx.lineTo(76 + side * 46, -64);
    ctx.moveTo(76, -50);
    ctx.lineTo(76 + side * 48, -48);
    ctx.stroke();
  }
  ctx.fillStyle = "#fffafc";
  ctx.font = "900 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("MELODY", 24, -112);
  ctx.restore();
}

function drawPlayer() {
  const p = game.player;
  const ground = getGroundY();
  const duck = p.ducking ? 1 : 0;
  const jumpLift = p.onGround ? 0 : Math.sin(game.time * 18) * 4;
  ctx.save();
  ctx.translate(p.x, p.ducking ? ground - p.r * 1.0 : p.y + jumpLift);
  ctx.rotate(p.ducking ? -0.12 : p.onGround ? Math.sin(game.time * 13) * 0.025 : -0.1);
  const squash = p.jumpSquash > 0 ? 0.08 : 0;
  ctx.scale(1 + squash, 1 - squash * 0.4);

  if (p.shieldTime > 0) {
    ctx.strokeStyle = "rgba(123, 231, 199, 0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, p.r * 0.88, p.r * 2.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(123, 231, 199, 0.12)";
    ctx.fill();
  }
  if (p.magnetTime > 0) {
    ctx.strokeStyle = "rgba(255, 91, 110, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-p.r * 1.25, -p.r * 0.6, p.r * 0.42, Math.PI * 0.18, Math.PI * 1.82);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, ground - (p.ducking ? ground - p.r * 1.0 : p.y) + 8, p.r * 1.35, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#463950";
  ctx.lineWidth = Math.max(5, p.r * 0.18);
  ctx.lineCap = "round";
  const bodyTop = duck ? p.r * 0.18 : p.r * 0.82;
  const bodyBottom = duck ? p.r * 0.95 : p.r * 2.2;

  ctx.fillStyle = "#ff8cc6";
  ctx.beginPath();
  ctx.roundRect(-p.r * 0.58, bodyTop, p.r * 1.16, bodyBottom - bodyTop, p.r * 0.32);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffafc";
  ctx.font = "900 " + Math.round(p.r * 0.37) + "px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("LOUISE", 0, bodyTop + (bodyBottom - bodyTop) * 0.58);

  ctx.strokeStyle = "#f6c36d";
  ctx.beginPath();
  ctx.moveTo(-p.r * 0.45, bodyTop + p.r * 0.32);
  ctx.lineTo(-p.r * 1.24, bodyTop + p.r * (duck ? 0.45 : 0.88));
  ctx.moveTo(p.r * 0.45, bodyTop + p.r * 0.32);
  ctx.lineTo(p.r * 1.2, bodyTop + p.r * (duck ? 0.18 : 0.58));
  ctx.stroke();

  ctx.strokeStyle = "#ffe66d";
  ctx.lineWidth = Math.max(4, p.r * 0.15);
  ctx.beginPath();
  ctx.moveTo(-p.r * 0.26, bodyBottom - 2);
  ctx.lineTo(-p.r * 0.58, p.r * 2.78);
  ctx.moveTo(p.r * 0.26, bodyBottom - 2);
  ctx.lineTo(p.r * 0.66, p.r * 2.72);
  ctx.stroke();

  drawMakeupGun(p);
  drawPlayerHead(p, duck ? -p.r * 0.18 : 0);
  ctx.restore();
}

function drawPlayerHead(p, offsetY) {
  const r = p.r * 0.76;
  const y = offsetY;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (images.face.loaded) {
    ctx.drawImage(images.face, -r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#ffd2b8";
    ctx.fillRect(-r, y - r, r * 2, r * 2);
    ctx.fillStyle = "#3a2b33";
    ctx.beginPath();
    ctx.arc(-r * 0.28, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.arc(r * 0.28, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b64b67";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, y + r * 0.12, r * 0.34, 0.12, Math.PI - 0.12);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#fffafc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMakeupGun(p) {
  const y = p.ducking ? p.r * 0.5 : p.r * 1.22;
  ctx.save();
  ctx.translate(p.r * 1.14, y);
  ctx.rotate(-0.06);
  ctx.fillStyle = "#b49bff";
  ctx.strokeStyle = "#463950";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-p.r * 0.12, -p.r * 0.16, p.r * 0.86, p.r * 0.32, p.r * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff8cc6";
  ctx.fillRect(p.r * 0.58, -p.r * 0.08, p.r * 0.34, p.r * 0.16);
  if (p.fireFlash > 0) {
    ctx.fillStyle = "rgba(255, 230, 109, 0.95)";
    ctx.beginPath();
    ctx.moveTo(p.r * 0.94, 0);
    ctx.lineTo(p.r * 1.62, -p.r * 0.34);
    ctx.lineTo(p.r * 1.34, 0);
    ctx.lineTo(p.r * 1.62, p.r * 0.34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of game.enemies) {
    if (enemy.type === "lowWall") drawLowWall(enemy);
    else if (enemy.type === "highWall") drawHighWall(enemy);
    else if (enemy.type === "lava") drawLava(enemy);
    else drawSmallCat(enemy);
  }
}

function drawLowWall(enemy) {
  const x = enemy.x;
  const y = enemy.y;
  const glow = 0.5 + Math.sin(game.time * 10 + x * 0.02) * 0.5;
  const rumble = getLowWallOffset(enemy);
  ctx.fillStyle = "rgba(87,45,28,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + 9, enemy.w * 0.78, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8b4b2f";
  ctx.strokeStyle = "#fff1cf";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - enemy.w * 0.62, y - 13, enemy.w * 1.24, 25, 7);
  ctx.fill();
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, y - enemy.h, 0, y);
  gradient.addColorStop(0, "#ffc36f");
  gradient.addColorStop(0.5, "#ff8a5f");
  gradient.addColorStop(1, "#c95236");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#fff1cf";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - enemy.w / 2 + rumble, y - enemy.h, enemy.w, enemy.h + 2, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 241, 207, 0.45)";
  const brickH = 18;
  for (let by = y - enemy.h + 18; by < y - 8; by += brickH) {
    ctx.fillRect(x - enemy.w / 2 + 8, by, enemy.w - 16, 4);
  }

  ctx.fillStyle = "rgba(255, 230, 109, " + (0.18 + glow * 0.18) + ")";
  ctx.beginPath();
  ctx.arc(x, y - enemy.h - 8, enemy.w * 0.55, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 4; i += 1) {
    const dustX = x - enemy.w * 0.45 + i * enemy.w * 0.3 + Math.sin(game.time * 8 + i) * 4;
    const dustY = y - 3 - Math.abs(Math.sin(game.time * 6 + i)) * 11;
    ctx.fillStyle = "rgba(255, 228, 176, 0.55)";
    ctx.beginPath();
    ctx.arc(dustX, dustY, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  drawObstacleLabel("JUMP", x, y - enemy.h * 0.55, "#2a2438");
}

function drawHighWall(enemy) {
  const x = enemy.x;
  const sway = getHighWallOffset(enemy);
  const beamH = 24;
  ctx.fillStyle = "#26354d";
  ctx.strokeStyle = "#bfeaff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - enemy.w * 0.72, 0, enemy.w * 1.44, beamH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(191,234,255,0.86)";
  ctx.lineWidth = 4;
  for (const cx of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.moveTo(x + enemy.w * cx, beamH - 2);
    ctx.lineTo(x + enemy.w * cx + sway, Math.min(enemy.bottom - 16, beamH + 64));
    ctx.stroke();
  }

  ctx.shadowColor = "rgba(139, 211, 255, 0.8)";
  ctx.shadowBlur = 16;
  const gradient = ctx.createLinearGradient(0, 0, 0, enemy.bottom);
  gradient.addColorStop(0, "#6fe7ff");
  gradient.addColorStop(0.42, "#7f69c9");
  gradient.addColorStop(1, "#4b3c96");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#e8fbff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - enemy.w / 2 + sway, 0, enemy.w, enemy.bottom, 12);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let y = 16; y < enemy.bottom - 12; y += 22) {
    ctx.fillRect(x - enemy.w / 2 + sway + 10, y, enemy.w - 20, 5);
  }

  ctx.fillStyle = "rgba(21, 25, 38, 0.34)";
  ctx.beginPath();
  ctx.ellipse(x + sway, enemy.bottom + 7, enemy.w * 0.54, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = "rgba(139, 211, 255, 0.58)";
    ctx.beginPath();
    ctx.arc(x - enemy.w * 0.45 + i * enemy.w * 0.22, enemy.bottom + Math.sin(game.time * 6 + i) * 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawObstacleLabel("DUCK", x, enemy.bottom - 30, "#fffafc");
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("PLAFOND", x, Math.min(42, enemy.bottom - 52));
}

function drawLava(enemy) {
  const x = enemy.x;
  const ground = getGroundY();
  const w = enemy.w;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, ground + 9, w * 0.58, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#332b36";
  ctx.strokeStyle = "#fffafc";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, ground - 6, w, 54, 14);
  ctx.fill();
  ctx.stroke();
  const lava = ctx.createLinearGradient(0, ground + 4, 0, ground + 42);
  lava.addColorStop(0, "#fff37a");
  lava.addColorStop(0.35, "#ff8b2b");
  lava.addColorStop(1, "#d91f16");
  ctx.fillStyle = lava;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 10, ground + 8, w - 20, 30, 10);
  ctx.fill();
  ctx.strokeStyle = "#fff37a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let lx = x - w / 2 + 16; lx < x + w / 2 - 12; lx += 18) {
    const ly = ground + 23 + Math.sin(game.time * 9 + lx) * 5;
    if (lx === x - w / 2 + 16) ctx.moveTo(lx, ly);
    else ctx.lineTo(lx, ly);
  }
  ctx.stroke();
  drawObstacleLabel("LAVA", x, ground - 24, "#ff5b6e");
}

function drawSmallCat(enemy) {
  const x = enemy.x;
  const y = enemy.y;
  const r = enemy.h * 0.65;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, enemy.w * 0.46, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#161616";
  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.62, r * 1.2, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.85, y - r * 0.86, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.58, y - r * 1.18);
  ctx.lineTo(x + r * 0.67, y - r * 1.58);
  ctx.lineTo(x + r * 0.9, y - r * 1.2);
  ctx.moveTo(x + r * 1.05, y - r * 1.17);
  ctx.lineTo(x + r * 1.28, y - r * 1.48);
  ctx.lineTo(x + r * 1.27, y - r * 1.02);
  ctx.fill();
  ctx.fillStyle = "#ffe66d";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.72, y - r * 0.88, r * 0.09, r * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.95, y - r * 0.88, r * 0.09, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  drawObstacleLabel("FIRE", x, y - r * 2.05, "#ff8cc6");
}

function drawObstacleLabel(text, x, y, color) {
  ctx.save();
  ctx.font = "900 15px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();
  ctx.roundRect(x - metrics.width / 2 - 10, y - 13, metrics.width + 20, 26, 9);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCoins() {
  for (const coin of game.coins) drawCoin(coin.x, coin.y + Math.sin(coin.bob) * 5, coin.r);
}

function drawPowerups() {
  for (const item of game.powerups) {
    const y = item.y + Math.sin(item.bob) * 6;
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = getPowerupColor(item.type);
    ctx.beginPath();
    ctx.arc(item.x, y, item.r * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const img = getPowerupImage(item.type);
    if (img.loaded) {
      const size = getPowerupDrawSize(item);
      drawRoundImage(img, item.x, y, size.w, size.h, size.radius);
    } else if (item.type === "cookie") {
      drawCookie(item.x, y, item.r);
    } else if (item.type === "chocolate") {
      drawChocolate(item.x, y, item.r);
    } else {
      drawSeafood(item.x, y, item.r);
    }
    drawPowerupLabel(item, y);
  }
}

function getPowerupImage(type) {
  if (type === "cookie") return images.cookie;
  if (type === "chocolate") return images.chocolate;
  return images.seafood;
}

function getPowerupDrawSize(item) {
  if (item.type === "cookie") return { w: item.r * 4.2, h: item.r * 1.7, radius: 10 };
  if (item.type === "chocolate") return { w: item.r * 4.7, h: item.r * 1.75, radius: 12 };
  return { w: item.r * 3.1, h: item.r * 3.1, radius: 16 };
}

function drawPowerupLabel(item, y) {
  const label = getPowerupLabel(item.type);
  const color = getPowerupColor(item.type);
  ctx.save();
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(label);
  ctx.fillStyle = "rgba(42,36,56,0.78)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(item.x - metrics.width / 2 - 12, y - item.r - 33, metrics.width + 24, 24, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffafc";
  ctx.fillText(label, item.x, y - item.r - 21);
  ctx.restore();
}

function getPowerupLabel(type) {
  if (type === "cookie") return "SCHILD";
  if (type === "seafood") return "MAGNEET";
  return "BOOST";
}

function getPowerupColor(type) {
  if (type === "cookie") return "#7be7c7";
  if (type === "seafood") return "#8bd3ff";
  return "#b49bff";
}

function drawProjectiles() {
  for (const projectile of game.projectiles) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.spin);
    if (projectile.type === "lipstick") {
      ctx.fillStyle = "#3b3148";
      ctx.fillRect(-projectile.r * 1.1, -projectile.r * 0.38, projectile.r * 0.9, projectile.r * 0.76);
      ctx.fillStyle = "#ff3f9e";
      ctx.beginPath();
      ctx.roundRect(-projectile.r * 0.2, -projectile.r * 0.48, projectile.r * 1.9, projectile.r * 0.96, projectile.r * 0.25);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ffc6df";
      ctx.beginPath();
      ctx.arc(0, 0, projectile.r * 1.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff66ac";
      ctx.beginPath();
      ctx.arc(projectile.r * 0.2, -projectile.r * 0.12, projectile.r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawCoin(x, y, r) {
  ctx.fillStyle = "#ffc247";
  ctx.strokeStyle = "#fff7b0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7b4c14";
  ctx.font = "900 " + Math.round(r * 1.05) + "px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", x, y + 1);
}

function drawCookie(x, y, r) {
  ctx.fillStyle = "#ba743b";
  ctx.strokeStyle = "#ffd6a1";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - r * 2.1, y - r * 0.82, r * 4.2, r * 1.64, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 " + Math.round(r * 0.36) + "px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Zaans", x, y - r * 0.12);
  ctx.fillText("huisje", x, y + r * 0.32);
}

function drawChocolate(x, y, r) {
  ctx.fillStyle = "#7654c2";
  ctx.strokeStyle = "#ff4aa4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - r * 2.25, y - r * 0.8, r * 4.5, r * 1.6, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fffafc";
  ctx.font = "900 " + Math.round(r * 0.72) + "px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Milka", x, y);
}

function drawSeafood(x, y, r) {
  ctx.fillStyle = "#19bcb0";
  ctx.strokeStyle = "#eafffb";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - r * 1.12, y - r * 1.12, r * 2.24, r * 2.24, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 " + Math.round(r * 0.46) + "px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ZEE", x, y - r * 0.12);
  ctx.fillText("20x", x, y + r * 0.42);
}

function drawRoundImage(img, x, y, w, h, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawSparks() {
  for (const spark of sparks) {
    ctx.globalAlpha = Math.max(0, spark.life / 0.55);
    ctx.fillStyle = spark.color;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 20px system-ui";
  for (const popup of popups) {
    ctx.globalAlpha = Math.max(0, popup.life / 0.75);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(42,36,56,0.72)";
    ctx.strokeText(popup.text, popup.x, popup.y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function clearControls() {
  keys.clear();
  activePointers.clear();
  game.player.ducking = false;
}

function activePointersHas(action) {
  for (const value of activePointers.values()) {
    if (value === action) return true;
  }
  return false;
}

function bindPress(element, action) {
  let lastPress = 0;
  function run(event) {
    if (event) event.preventDefault();
    const now = performance.now();
    if (now - lastPress < 180) return;
    lastPress = now;
    action();
  }
  element.addEventListener("click", run);
  element.addEventListener("pointerup", run);
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resizeCanvas);
  window.addEventListener("blur", clearControls);

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if ([" ", "arrowup", "w"].includes(key)) {
      event.preventDefault();
      jump();
    } else if (["arrowdown", "s"].includes(key)) {
      event.preventDefault();
      keys.add(key);
      setDuck(true);
    } else if (key === "f") {
      event.preventDefault();
      shoot();
    } else if (key === "p" || key === "escape") {
      event.preventDefault();
      togglePause();
    }
  }, { passive: false });

  window.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if (key === "arrowdown" || key === "s") setDuck(false);
  });

  bindPress(document.getElementById("startButton"), startGame);
  bindPress(document.getElementById("restartButton"), startGame);
  bindPress(document.getElementById("restartPauseButton"), startGame);
  bindPress(document.getElementById("resumeButton"), resumeGame);
  bindPress(document.getElementById("pauseButton"), togglePause);
  bindPress(document.getElementById("musicButton"), toggleMute);
  bindPress(document.getElementById("howButton"), () => {
    howOverlay.hidden = false;
  });
  bindPress(document.getElementById("closeHowButton"), () => {
    howOverlay.hidden = true;
  });
  bindPress(document.getElementById("menuButton"), () => {
    state = "menu";
    countdownToken += 1;
    gameOverOverlay.hidden = true;
    pauseOverlay.hidden = true;
    startOverlay.hidden = false;
    if (musicAudio) musicAudio.pause();
    updateHud();
  });

  document.querySelectorAll(".map-option").forEach(button => {
    bindPress(button, () => {
      selectedMap = button.dataset.map || "stad";
      document.querySelectorAll(".map-option").forEach(option => option.classList.remove("active"));
      button.classList.add("active");
      statusText.textContent = "Map gekozen: " + button.textContent + ".";
    });
  });

  document.querySelectorAll(".difficulty-option").forEach(button => {
    bindPress(button, () => {
      selectedDifficulty = button.dataset.difficulty || "normal";
      document.querySelectorAll(".difficulty-option").forEach(option => option.classList.remove("active"));
      button.classList.add("active");
      statusText.textContent = "Moeilijkheid: " + DIFFICULTIES[selectedDifficulty].label + ".";
    });
  });

  canvas.addEventListener("pointerdown", event => {
    if (event.target && event.target.closest && event.target.closest("button")) return;
    event.preventDefault();
    jump();
  }, { passive: false });

  document.querySelectorAll(".touch-controls button").forEach(button => {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      const action = button.dataset.action;
      activePointers.set(event.pointerId, action);
      button.setPointerCapture(event.pointerId);
      if (action === "jump") jump();
      if (action === "duck") setDuck(true);
      if (action === "fire") shoot();
    }, { passive: false });

    function release(event) {
      event.preventDefault();
      const action = activePointers.get(event.pointerId);
      activePointers.delete(event.pointerId);
      if (action === "duck") setDuck(activePointersHas("duck"));
    }

    button.addEventListener("pointerup", release, { passive: false });
    button.addEventListener("pointercancel", release, { passive: false });
    button.addEventListener("lostpointercapture", event => {
      const action = activePointers.get(event.pointerId);
      activePointers.delete(event.pointerId);
      if (action === "duck") setDuck(activePointersHas("duck"));
    });
  });
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    return this;
  };
}

loadAssets();
bindEvents();
resizeCanvas();
resetGame();
updateHud();
requestAnimationFrame(loop);
