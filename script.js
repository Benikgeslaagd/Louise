"use strict";

    // Vervang deze bestandsnamen door je eigen foto's. Zet de bestanden naast index.html.
    // Voor het meisje uit je foto: maak een vierkante uitsnede van haar gezicht en noem die gezicht1.png.
    const ASSET_FILES = {
      player: "speler.png",
      faces: ["gezicht1.png"],
      coin: "munt.png",
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
    const powerupText = document.getElementById("powerupText");
    const statusText = document.getElementById("statusText");
    const musicButton = document.getElementById("musicButton");
    const startOverlay = document.getElementById("startOverlay");
    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameOverText = document.getElementById("gameOverText");
    const tips = document.getElementById("tips");
    const mapPicker = document.getElementById("mapPicker");

    const keys = new Set();
    const touchDirs = new Set();
    const touchTarget = { active: false, pointerId: null, x: 0, y: 0 };
    const images = {};
    let width = 900;
    let height = 580;
    let dpr = 1;
    let lastTime = 0;
    let state = "menu";
    let spawnTimer = 0;
    let treatTimer = 0;
    let coinTimer = 0;
    let shake = 0;
    let highScore = Number(localStorage.getItem("kaasChaosHighScore") || 0);
    let audioContext = null;
    let musicAudio = null;
    let musicAudioFailed = false;
    let musicPlaying = false;
    let musicTimer = null;
    let musicStep = 0;
    localStorage.setItem("kaasChaosMusic", "on");
    let musicEnabled = true;
    let selectedMap = "stad";
    let shootCooldown = 0;

    const MAPS = {
      stad: { sky: "#122033", glow: "#56b6ff", groundTop: "#29333d", groundBottom: "#171d24", lane: "#ffd84d" },
      strand: { sky: "#0a6f8f", glow: "#ffd84d", groundTop: "#d9a85f", groundBottom: "#8b6535", lane: "#fff6dc" },
      snoep: { sky: "#34204d", glow: "#ff75b7", groundTop: "#6d3fd1", groundBottom: "#2a163f", lane: "#51e0a4" }
    };

    const game = {
      score: 0,
      lives: 3,
      time: 0,
      player: { x: 0, y: 0, r: 28, vy: 0, onGround: true, ducking: false, invincible: 0, shieldTime: 0, powerTime: 0, magnetTime: 0 },
      enemies: [],
      treats: [],
      coins: [],
      projectiles: [],
      crashes: 0,
      pickups: 0,
      catDistance: 230
    };

    function loadImage(src) {
      const img = new Image();
      img.src = src;
      img.loaded = false;
      img.onload = () => {
        img.loaded = true;
      };
      img.onerror = () => {
        img.loaded = false;
      };
      return img;
    }

    function loadAssets() {
      images.player = loadImage(ASSET_FILES.player);
      images.faces = ASSET_FILES.faces.map(loadImage);
      images.coin = loadImage(ASSET_FILES.coin);
      images.cookie = loadImage(ASSET_FILES.cookie);
      images.chocolate = loadImage(ASSET_FILES.chocolate);
      images.seafood = loadImage(ASSET_FILES.seafood);
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

    function resetGame() {
      game.score = 0;
      game.lives = 3;
      game.time = 0;
      game.enemies = [];
      game.treats = [];
      game.coins = [];
      game.projectiles = [];
      game.crashes = 0;
      game.pickups = 0;
      game.catDistance = 230;
      touchDirs.clear();
      touchTarget.active = false;
      spawnTimer = 0;
      treatTimer = 30;
      coinTimer = 2.5;
      shootCooldown = 0;
      shake = 0;
      game.player.r = Math.max(22, Math.min(width < 700 ? 38 : 34, width * (width < 700 ? 0.052 : 0.034)));
      game.player.x = Math.max(96, width * 0.22);
      game.player.y = getRunnerHeadY();
      game.player.vy = 0;
      game.player.onGround = true;
      game.player.ducking = false;
      game.player.invincible = 0.8;
      game.player.shieldTime = 0;
      game.player.powerTime = 0;
      game.player.magnetTime = 0;
      updateHud();
    }

    function startGame() {
      resetGame();
      state = "playing";
      startOverlay.hidden = true;
      gameOverOverlay.hidden = true;
      statusText.textContent = "Melody rent achter Louise aan.";
      if (musicEnabled) startMusic();
      lastTime = performance.now();
    }

    function endGame() {
      state = "gameover";
      highScore = Math.max(highScore, game.score);
      localStorage.setItem("kaasChaosHighScore", String(highScore));
      const eaten = game.crashes >= 3 ? " Melody heeft Louise opgegeten." : "";
      gameOverText.textContent = "Je score: " + game.score + " | Highscore: " + highScore + eaten;
      gameOverOverlay.hidden = false;
      updateHud();
    }

    function updateHud() {
      scoreText.textContent = String(game.score);
      highScoreText.textContent = String(highScore);
      livesText.textContent = game.crashes + "/3";
      powerupText.textContent = game.treats.length > 0 ? "NU" : Math.max(0, Math.ceil(treatTimer)) + "s";
      musicButton.textContent = musicPlaying ? "Stop muziek" : "Start muziek";
    }

    function ensureAudioContext() {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) return null;
      if (!audioContext) {
        audioContext = new AudioEngine();
      }
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
      return audioContext;
    }

    function playTone(frequency, duration, type, volume) {
      if (!audioContext || !musicEnabled) return;

      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
    }

    function playSfx(kind) {
      const ctxAudio = ensureAudioContext();
      if (!ctxAudio) return;
      const now = ctxAudio.currentTime;
      const oscillator = ctxAudio.createOscillator();
      const gain = ctxAudio.createGain();
      oscillator.type = kind === "gameover" ? "sawtooth" : "square";
      oscillator.frequency.setValueAtTime(kind === "gameover" ? 220 : 520, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "gameover" ? 70 : 190, now + (kind === "gameover" ? 0.65 : 0.22));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "gameover" ? 0.12 : 0.08, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "gameover" ? 0.72 : 0.26));
      oscillator.connect(gain);
      gain.connect(ctxAudio.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === "gameover" ? 0.75 : 0.3));
    }

    function tickMusic() {
      const melody = [392, 494, 587, 659, 587, 494, 440, 523, 659, 784, 659, 587, 523, 440, 392, 494];
      const bass = [196, 196, 220, 220, 247, 247, 220, 220];
      const note = melody[musicStep % melody.length];
      playTone(note, 0.13, "square", 0.035);
      if (musicStep % 2 === 0) {
        playTone(bass[Math.floor(musicStep / 2) % bass.length], 0.18, "triangle", 0.025);
      }
      musicStep += 1;
    }

    function startMusic() {
      musicEnabled = true;
      localStorage.setItem("kaasChaosMusic", "on");
      if (startSongFile()) return;
      if (!ensureAudioContext()) return;
      if (musicTimer) return;
      tickMusic();
      musicTimer = window.setInterval(tickMusic, 185);
      musicPlaying = true;
      statusText.textContent = "Fallback muziekje gestart.";
      updateHud();
    }

    function stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
      if (musicAudio) {
        musicAudio.pause();
      }
      musicPlaying = false;
      musicEnabled = false;
      localStorage.setItem("kaasChaosMusic", "off");
      statusText.textContent = "Muziek gestopt.";
      updateHud();
    }

    function startSongFile() {
      if (musicAudioFailed) return false;
      if (!musicAudio) {
        musicAudio = new Audio(ASSET_FILES.music);
        musicAudio.loop = true;
        musicAudio.volume = 0.55;
        musicAudio.addEventListener("error", () => {
          musicAudioFailed = true;
          musicAudio = null;
          musicPlaying = false;
          statusText.textContent = "one-last-time.mp3 niet gevonden, fallback muziek gestart.";
          updateHud();
          if (musicEnabled) startMusic();
        }, { once: true });
      }
      const playPromise = musicAudio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.then(() => {
          musicPlaying = true;
          statusText.textContent = "One Last Time speelt.";
          updateHud();
        }).catch(() => {
          musicPlaying = false;
          statusText.textContent = "Tik op Start muziek om audio toe te staan.";
          updateHud();
        });
      } else {
        musicPlaying = true;
        statusText.textContent = "One Last Time speelt.";
        updateHud();
      }
      return true;
    }

    function toggleMusic() {
      if (musicPlaying || musicTimer || (musicAudio && !musicAudio.paused)) {
        stopMusic();
      } else {
        startMusic();
      }
    }

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function clampPlayer() {
      if (!game.player) return;
      const r = game.player.r || 26;
      game.player.x = Math.max(86, Math.min(width * 0.34, game.player.x || width * 0.22));
      game.player.y = Math.min(getRunnerHeadY(), Math.max(r + 74, game.player.y || getRunnerHeadY()));
    }

    function getGroundY() {
      const mobileOffset = width < 700 ? 128 : 54;
      return Math.min(height - mobileOffset, Math.max(310, height * (width < 700 ? 0.72 : 0.78)));
    }

    function getRunnerHeadY() {
      return getGroundY() - game.player.r * 2.18;
    }

    function addEnemy() {
      const roll = Math.random();
      const type = roll < 0.22 ? "lowWall" : roll < 0.34 ? "highWall" : roll < 0.58 ? "lava" : "smallCat";
      const r = type === "smallCat" ? randomBetween(24, 33) : type === "lava" ? randomBetween(34, 48) : randomBetween(54, Math.max(68, Math.min(92, width * 0.09)));
      const speed = getWorldSpeed() + randomBetween(35, 95);
      const groundY = getGroundY();
      const w = type === "lava" ? r * randomBetween(2.25, 3.0) : type === "highWall" ? r * 2.55 : type === "smallCat" ? r * 2.25 : r * randomBetween(1.65, 2.2);
      const h = type === "lava" ? r * 0.52 : type === "highWall" ? r * 1.7 : type === "smallCat" ? r * 1.18 : r * randomBetween(2.2, 2.75);
      const ceilingY = type === "highWall" ? groundY - h - game.player.r * 1.28 : Math.max(72, groundY - r * 4.05);
      const obstacleY = type === "highWall" ? ceilingY + h : groundY;
      game.enemies.push({
        type,
        x: width + r + randomBetween(0, width * 0.28),
        y: obstacleY,
        ceilingY,
        r,
        w,
        h,
        vx: -speed,
        vy: 0,
        cracked: false
      });
    }

    function getWorldSpeed() {
      const chocolateBoost = game.player.powerTime > 0 ? 70 : 0;
      return Math.min(560, 170 + game.time * 4.8 + game.pickups * 13 + chocolateBoost);
    }

    function addTreat(type, visibleNow) {
      const treatData = {
        cookie: { r: 35, value: 75 },
        chocolate: { r: 39, value: 100 },
        seafood: { r: 42, value: 125 }
      };
      const data = treatData[type] || treatData.cookie;
      const groundY = getGroundY();
      const x = visibleNow ? randomBetween(width * 0.5, width - 60) : width + randomBetween(60, width * 0.55);
      const y = type === "coin" ? randomBetween(groundY - 190, groundY - 90) : randomBetween(groundY - 178, groundY - 112);
      game.treats.push({
        type,
        x,
        y,
        r: data.r,
        value: data.value,
        vx: -getWorldSpeed(),
        bob: randomBetween(0, Math.PI * 2)
      });
    }

    function addCoinPattern() {
      const groundY = getGroundY();
      const jumpPattern = Math.random() < 0.45;
      const count = jumpPattern ? 4 : 5;
      const startX = width + randomBetween(80, 180);
      const baseY = jumpPattern ? groundY - randomBetween(178, 220) : groundY - randomBetween(92, 130);
      for (let i = 0; i < count; i += 1) {
        const arc = jumpPattern ? Math.sin((i / (count - 1)) * Math.PI) * 42 : Math.sin(i * 0.8) * 10;
        game.coins.push({
          x: startX + i * 42,
          y: baseY - arc,
          r: 15,
          value: 20,
          vx: -getWorldSpeed(),
          bob: randomBetween(0, Math.PI * 2)
        });
      }
    }

    function randomPowerupType() {
      const roll = Math.random();
      if (roll < 0.34) return "seafood";
      if (roll < 0.67) return "chocolate";
      return "cookie";
    }

    function jump() {
      if (state === "menu") {
        startGame();
        return;
      }
      if (state !== "playing") return;
      if (!game.player.onGround) return;
      const boost = game.player.powerTime > 0 ? 1.08 : 1;
      game.player.vy = -Math.max(650, height * 1.15) * boost;
      game.player.onGround = false;
    }

    function shoot() {
      if (state === "menu") {
        startGame();
        return;
      }
      if (state !== "playing" || shootCooldown > 0) return;
      const p = game.player;
      game.projectiles.push({
        x: p.x + p.r * 1.1,
        y: p.y + p.r * 0.7,
        vx: getWorldSpeed() + 520,
        r: Math.max(8, p.r * 0.25),
        spin: 0,
        type: Math.random() < 0.5 ? "lipstick" : "blush"
      });
      shootCooldown = game.player.powerTime > 0 ? 0.22 : 0.34;
      statusText.textContent = "Make-up aanval!";
    }

    function update(dt) {
      if (state !== "playing") return;

      game.time += dt;
      game.score += Math.round(dt * 9);
      spawnTimer -= dt;
      treatTimer -= dt;
      coinTimer -= dt;
      shootCooldown = Math.max(0, shootCooldown - dt);
      shake = Math.max(0, shake - dt * 20);
      game.player.invincible = Math.max(0, game.player.invincible - dt);
      game.player.shieldTime = Math.max(0, game.player.shieldTime - dt);
      game.player.powerTime = Math.max(0, game.player.powerTime - dt);
      game.player.magnetTime = Math.max(0, game.player.magnetTime - dt);
      if (!keys.has("arrowdown") && !keys.has("s") && !touchDirs.has("duck")) {
        game.player.ducking = false;
      }

      const gravity = Math.max(1180, height * 2.35);
      const groundHeadY = getRunnerHeadY();
      game.player.vy += gravity * dt;
      game.player.y += game.player.vy * dt;
      if (game.player.y >= groundHeadY) {
        game.player.y = groundHeadY;
        game.player.vy = 0;
        game.player.onGround = true;
      }
      clampPlayer();

      if (spawnTimer <= 0) {
        addEnemy();
        spawnTimer = randomBetween(1.0, 2.0);
      }

      if (treatTimer <= 0 && game.treats.length < 1) {
        addTreat(randomPowerupType());
        treatTimer = 30;
      }

      if (coinTimer <= 0 && game.coins.length < 8) {
        addCoinPattern();
        coinTimer = randomBetween(5.5, 8.0);
      }

      for (const enemy of game.enemies) {
        enemy.vx = -getWorldSpeed() - enemy.r * 0.45;
        enemy.x += enemy.vx * dt;
      }

      game.enemies = game.enemies.filter(enemy =>
        enemy.x > -140 && enemy.x < width + 220 && enemy.y > -120 && enemy.y < height + 120
      );

      for (const treat of game.treats) {
        treat.bob += dt * 4;
        treat.vx = -getWorldSpeed() * 0.92;
        if (game.player.magnetTime > 0 && treat.type !== "coin") {
          const dx = game.player.x - treat.x;
          const dy = game.player.y - treat.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 260) {
            treat.x += (dx / dist) * 135 * dt;
            treat.y += (dy / dist) * 135 * dt;
          }
        }
        treat.x += treat.vx * dt;
      }
      game.treats = game.treats.filter(treat => treat.x > -170);

      for (const coin of game.coins) {
        coin.bob += dt * 5;
        coin.vx = -getWorldSpeed() * 0.92;
        coin.x += coin.vx * dt;
      }
      game.coins = game.coins.filter(coin => coin.x > -80);

      for (const projectile of game.projectiles) {
        projectile.x += projectile.vx * dt;
        projectile.spin += dt * 10;
      }
      game.projectiles = game.projectiles.filter(projectile => projectile.x < width + 90);

      collectTreats();
      collectCoins();
      checkProjectileHits();
      checkEnemyHits();
      updateHud();
    }

    function collectTreats() {
      for (let i = game.treats.length - 1; i >= 0; i -= 1) {
        const treat = game.treats[i];
        const dx = game.player.x - treat.x;
        const dy = (game.player.y + game.player.r * 0.4) - treat.y;
        const dist = Math.hypot(dx, dy);
        const pickupRadius = treat.type === "coin" ? treat.r : treat.r * 1.45;
        if (dist < game.player.r + pickupRadius) {
          game.score += treat.value;
          game.pickups += 1;
          applyPowerup(treat.type);
          game.treats.splice(i, 1);
          statusText.textContent = getTreatMessage(treat.type);
          addSpark(treat.x, treat.y, getTreatColor(treat.type));
        }
      }
    }

    function collectCoins() {
      for (let i = game.coins.length - 1; i >= 0; i -= 1) {
        const coin = game.coins[i];
        const dx = game.player.x - coin.x;
        const dy = (game.player.y + game.player.r * 0.4) - coin.y;
        const dist = Math.hypot(dx, dy);
        if (dist < game.player.r + coin.r) {
          game.score += coin.value;
          game.coins.splice(i, 1);
          addSpark(coin.x, coin.y, "#ffb32c");
          statusText.textContent = "Munt gepakt!";
        }
      }
    }

    function checkProjectileHits() {
      for (let p = game.projectiles.length - 1; p >= 0; p -= 1) {
        const projectile = game.projectiles[p];
        for (let e = game.enemies.length - 1; e >= 0; e -= 1) {
          const enemy = game.enemies[e];
          if (
            enemy.type === "smallCat" &&
            projectile.x + projectile.r > enemy.x - enemy.w / 2 &&
            projectile.x - projectile.r < enemy.x + enemy.w / 2 &&
            projectile.y + projectile.r > enemy.y - enemy.h &&
            projectile.y - projectile.r < enemy.y
          ) {
            addSpark(projectile.x, projectile.y, projectile.type === "lipstick" ? "#ff5d9e" : "#ffc0dd");
            game.projectiles.splice(p, 1);
            game.enemies.splice(e, 1);
            game.score += 80;
            statusText.textContent = "Kleine kat geraakt met make-up!";
            break;
          } else if (
            enemy.type !== "smallCat" &&
            projectile.x + projectile.r > enemy.x - enemy.w / 2 &&
            projectile.x - projectile.r < enemy.x + enemy.w / 2 &&
            projectile.y + projectile.r > enemy.y - enemy.h &&
            projectile.y - projectile.r < enemy.y
          ) {
            addSpark(projectile.x, projectile.y, "#ffc0dd");
            game.projectiles.splice(p, 1);
            statusText.textContent = "Make-up werkt niet op muren!";
            break;
          }
        }
      }
    }

    function applyPowerup(type) {
      if (type === "cookie") {
        game.player.shieldTime = Math.max(game.player.shieldTime, 1.6);
      } else if (type === "chocolate") {
        game.player.powerTime = 4.2;
      } else if (type === "seafood") {
        game.player.magnetTime = 5.5;
      }
    }

    function getTreatMessage(type) {
      if (type === "cookie") return "Zaans-huisje-koekbonus!";
      if (type === "chocolate") return "Milka speedboost!";
      if (type === "seafood") return "Zeevruchten magneet!";
      return "Kaas-kassa!";
    }

    function getTreatColor(type) {
      if (type === "cookie") return "#0075bd";
      if (type === "chocolate") return "#c77dff";
      if (type === "seafood") return "#12d6c8";
      return "#ffb32c";
    }

    function checkEnemyHits() {
      for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = game.enemies[i];
        const isDucking = game.player.ducking && game.player.onGround;
        const playerHit = {
          x: game.player.x - game.player.r * 0.55,
          y: isDucking ? getGroundY() - game.player.r * 1.12 : game.player.y - game.player.r * 0.95,
          w: game.player.r * 1.65,
          h: isDucking ? game.player.r * 1.02 : game.player.r * 3.2
        };
        const enemyBox = {
          x: enemy.x - enemy.w / 2,
          y: enemy.type === "lava" ? getGroundY() - 8 : enemy.y - enemy.h,
          w: enemy.w,
          h: enemy.type === "lava" ? 20 : enemy.h
        };
        const hit = playerHit.x < enemyBox.x + enemyBox.w &&
          playerHit.x + playerHit.w > enemyBox.x &&
          playerHit.y < enemyBox.y + enemyBox.h &&
          playerHit.y + playerHit.h > enemyBox.y;

        if (hit && game.player.shieldTime > 0) {
          game.enemies.splice(i, 1);
          addSpark(enemy.x, enemy.y - enemy.h * 0.5, "#56b6ff");
          statusText.textContent = "Schild heeft Louise beschermd!";
          continue;
        }

        if (hit) {
          game.crashes += 1;
          game.catDistance = Math.max(30, 230 - game.crashes * 72);
          game.player.invincible = 1.0;
          shake = 10;
          game.enemies.splice(i, 1);
          statusText.textContent = game.crashes >= 3 ? "Melody heeft Louise!" : "Melody komt dichterbij!";
          if (game.crashes >= 3) {
            playSfx("gameover");
            endGame();
          } else {
            playSfx("hit");
          }
          return;
        }
      }
    }

    const sparks = [];

    function addSpark(x, y, color) {
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI * 2 * i) / 10;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * randomBetween(60, 150),
          vy: Math.sin(angle) * randomBetween(60, 150),
          life: 0.55,
          color
        });
      }
    }

    function updateSparks(dt) {
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        spark.life -= dt;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vy += 190 * dt;
        if (spark.life <= 0) sparks.splice(i, 1);
      }
    }

    function draw() {
      const offsetX = shake ? randomBetween(-shake, shake) : 0;
      const offsetY = shake ? randomBetween(-shake, shake) : 0;
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.translate(offsetX, offsetY);
      drawBackground();
      drawMelody();
      drawCoins();
      drawTreats();
      drawProjectiles();
      drawEnemies();
      drawPlayer();
      drawSparks();
      ctx.restore();
    }

    function drawBackground() {
      const map = MAPS[selectedMap] || MAPS.stad;
      const grid = Math.max(34, Math.min(58, width * 0.055));
      ctx.fillStyle = map.sky;
      ctx.fillRect(-20, -20, width + 40, height + 40);

      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#fff8df";
      ctx.lineWidth = 1;
      for (let x = -grid; x < width + grid; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * 0.18, height);
        ctx.stroke();
      }
      for (let y = -grid; y < height + grid; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y - width * 0.18);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const roadY = getGroundY();
      const roadHeight = Math.max(80, height - roadY + 30);
      const groundGradient = ctx.createLinearGradient(0, roadY, 0, height);
      groundGradient.addColorStop(0, map.groundTop);
      groundGradient.addColorStop(1, map.groundBottom);
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, roadY, width, roadHeight);
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillRect(0, roadY, width, 5);
      ctx.fillStyle = "rgba(255, 93, 115, 0.92)";
      ctx.font = "900 " + Math.round(Math.max(15, width * 0.018)) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("JUMP OVER WALLS + LAVA     DUCK UNDER HIGH WALLS     FIRE AT SMALL CATS", width / 2, roadY - 24);
      ctx.fillStyle = "rgba(255, 248, 223, 0.88)";
      ctx.font = "900 " + Math.round(Math.max(12, width * 0.014)) + "px system-ui";
      ctx.fillText("LAVA-FIX BUILD: real ground walls + ceiling walls + jumpable lava gaps", width / 2, roadY - 48);
      ctx.strokeStyle = map.lane;
      ctx.lineWidth = 5;
      const scroll = (game.time * getWorldSpeed() * 0.72) % 110;
      for (let x = -130 - scroll; x < width + 140; x += 110) {
        ctx.beginPath();
        ctx.moveTo(x, roadY + 44);
        ctx.lineTo(x + 56, roadY + 44);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const x = (width + 90 - ((game.time * getWorldSpeed() * 0.9 + i * 155) % (width + 220)));
        const y = 94 + ((i * 67) % Math.max(120, roadY - 150));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 58, y + 5);
        ctx.stroke();
      }

      ctx.fillStyle = selectedMap === "snoep" ? "rgba(255, 117, 183, 0.14)" : "rgba(255, 216, 77, 0.08)";
      for (let i = 0; i < 16; i += 1) {
        const x = (i * 173 - game.time * getWorldSpeed() * 0.22) % (width + 120) - 60;
        const y = (i * 89 + Math.sin(game.time + i) * 20) % (height + 120) - 60;
        ctx.beginPath();
        ctx.arc(x, y, 6 + (i % 3) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawMelody() {
      const p = game.player;
      const groundY = getGroundY();
      const scale = Math.max(0.85, Math.min(1.25, p.r / 29));
      const runCycle = game.time * 12;
      const x = Math.max(28, p.x - game.catDistance);
      const y = groundY - 12;
      const bodyW = 112 * scale;
      const bodyH = 54 * scale;
      const headR = 27 * scale;
      const legSwing = Math.sin(runCycle) * 10 * scale;

      ctx.save();
      ctx.translate(x, y);

      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(26 * scale, 8 * scale, bodyW * 0.58, 14 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = "round";
      ctx.strokeStyle = "#151515";
      ctx.lineWidth = 13 * scale;
      ctx.beginPath();
      ctx.moveTo(-44 * scale, -38 * scale);
      ctx.bezierCurveTo(-84 * scale, -70 * scale, -76 * scale, -105 * scale, -42 * scale, -94 * scale);
      ctx.stroke();

      ctx.fillStyle = "#161616";
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.ellipse(18 * scale, -42 * scale, bodyW * 0.5, bodyH * 0.55, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#111";
      ctx.lineWidth = 8 * scale;
      for (const leg of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo((-12 + leg * 23) * scale, -10 * scale);
        ctx.lineTo((-16 + leg * 22 + legSwing * leg) * scale, 12 * scale);
        ctx.stroke();
      }
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(53 * scale, -20 * scale);
      ctx.lineTo((72 + legSwing * 0.2) * scale, 5 * scale);
      ctx.moveTo(15 * scale, -15 * scale);
      ctx.lineTo((2 - legSwing * 0.2) * scale, 8 * scale);
      ctx.stroke();

      ctx.save();
      ctx.translate(72 * scale, -70 * scale);
      ctx.fillStyle = "#181818";
      ctx.strokeStyle = "#050505";
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.moveTo(-18 * scale, -20 * scale);
      ctx.lineTo(-31 * scale, -48 * scale);
      ctx.lineTo(-6 * scale, -31 * scale);
      ctx.moveTo(18 * scale, -20 * scale);
      ctx.lineTo(31 * scale, -48 * scale);
      ctx.lineTo(6 * scale, -31 * scale);
      ctx.fill();
      ctx.fillStyle = "#e4c66a";
      ctx.beginPath();
      ctx.ellipse(-9 * scale, -3 * scale, 7 * scale, 10 * scale, -0.18, 0, Math.PI * 2);
      ctx.ellipse(11 * scale, -3 * scale, 7 * scale, 10 * scale, 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillRect(-10.5 * scale, -9 * scale, 3 * scale, 12 * scale);
      ctx.fillRect(9.5 * scale, -9 * scale, 3 * scale, 12 * scale);
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.ellipse(1 * scale, 8 * scale, 6 * scale, 4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(245,245,245,0.72)";
      ctx.lineWidth = 1.4 * scale;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 6 * scale, 11 * scale);
        ctx.lineTo(side * 31 * scale, 3 * scale);
        ctx.moveTo(side * 6 * scale, 14 * scale);
        ctx.lineTo(side * 32 * scale, 15 * scale);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(255, 248, 223, 0.94)";
      ctx.font = "900 " + Math.round(14 * scale) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("MELODY", 50 * scale, -128 * scale);

      ctx.restore();
    }

    function drawPlayer() {
      const p = game.player;
      const blink = p.invincible > 0 && Math.floor(p.invincible * 12) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.45;
      const runCycle = game.time * (game.player.powerTime > 0 ? 18 : 14);
      const bob = p.onGround && state === "playing" ? Math.sin(runCycle) * 3.2 : 0;
      const isDucking = p.ducking && p.onGround;
      const lean = isDucking ? 0.85 : state === "playing" ? 0.1 : 0;
      const headR = p.r * 0.72;
      const bodyTop = p.r * 0.48;
      const bodyHeight = p.r * (isDucking ? 0.9 : 1.38);
      const legY = p.r * 1.92;

      ctx.save();
      ctx.globalAlpha *= 0.72;
      ctx.fillStyle = game.player.powerTime > 0 ? "rgba(199, 125, 255, 0.55)" : "rgba(255, 216, 77, 0.36)";
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(p.x - p.r * (2.1 + i * 0.55), p.y + bob - 5 + i * 4, p.r * 0.82, 5);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(p.x - p.r * 0.06, p.y + p.r * 1.05, p.r * 0.95, p.r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.rotate(lean);
      if (isDucking) ctx.translate(p.r * 0.28, p.r * 0.36);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffd84d";
      ctx.lineWidth = Math.max(7, p.r * 0.24);
      const legSwing = Math.sin(runCycle) * p.r * 0.58;
      const armSwing = Math.sin(runCycle + Math.PI) * p.r * 0.48;
      ctx.beginPath();
      ctx.moveTo(-p.r * 0.18, bodyTop + bodyHeight * 0.75);
      ctx.lineTo(-p.r * 0.48 + legSwing * 0.35, legY);
      ctx.lineTo(-p.r * 0.9 + legSwing, legY + p.r * 0.4);
      ctx.moveTo(p.r * 0.18, bodyTop + bodyHeight * 0.75);
      ctx.lineTo(p.r * 0.52 - legSwing * 0.35, legY);
      ctx.lineTo(p.r * 0.94 - legSwing, legY + p.r * 0.4);
      ctx.stroke();

      ctx.strokeStyle = "#ffb32c";
      ctx.lineWidth = Math.max(6, p.r * 0.19);
      ctx.beginPath();
      ctx.moveTo(-p.r * 0.48, bodyTop + bodyHeight * 0.22);
      ctx.lineTo(-p.r * 1.02 + armSwing, bodyTop + bodyHeight * 0.62);
      ctx.moveTo(p.r * 0.48, bodyTop + bodyHeight * 0.22);
      ctx.lineTo(p.r * 1.18, bodyTop + bodyHeight * 0.44);
      ctx.stroke();

      ctx.save();
      ctx.translate(p.r * 1.34, bodyTop + bodyHeight * 0.38);
      ctx.rotate(-0.08);
      ctx.fillStyle = "#ff5d9e";
      ctx.strokeStyle = "#fff8df";
      ctx.lineWidth = Math.max(2, p.r * 0.06);
      ctx.beginPath();
      ctx.roundRect(-p.r * 0.12, -p.r * 0.18, p.r * 0.92, p.r * 0.36, p.r * 0.1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.fillRect(-p.r * 0.4, -p.r * 0.12, p.r * 0.32, p.r * 0.24);
      ctx.fillStyle = "#ffc0dd";
      ctx.beginPath();
      ctx.arc(p.r * 0.68, 0, p.r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const bodyGradient = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyHeight);
      bodyGradient.addColorStop(0, "#51e0a4");
      bodyGradient.addColorStop(1, "#0075bd");
      ctx.fillStyle = bodyGradient;
      ctx.strokeStyle = "#fff8df";
      ctx.lineWidth = Math.max(2, p.r * 0.08);
      ctx.beginPath();
      ctx.roundRect(-p.r * 0.62, bodyTop, p.r * 1.24, bodyHeight, p.r * 0.3);
      ctx.fill();
      ctx.stroke();

      if (images.player.loaded) {
        drawRoundImage(images.player, 0, -p.r * 0.32, headR * 2, headR * 2, headR, true);
      } else {
        drawCheese(0, -p.r * 0.32, headR);
      }

      ctx.fillStyle = "#fff8df";
      ctx.font = "900 " + Math.round(p.r * 0.34) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LOUISE", 0, bodyTop + bodyHeight * 0.52);

      if (game.player.invincible > 0) {
        ctx.strokeStyle = "rgba(86, 182, 255, 0.82)";
        ctx.fillStyle = "rgba(86, 182, 255, 0.12)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, p.r * 0.62, p.r * 2.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff8df";
        ctx.font = "900 " + Math.round(p.r * 0.34) + "px system-ui";
        ctx.fillText("SHIELD", 0, -p.r * 1.55);
      }

      if (game.player.magnetTime > 0) {
        ctx.strokeStyle = "rgba(18, 214, 200, 0.72)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, p.r * 0.6, p.r * 2.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#12d6c8";
        ctx.font = "900 " + Math.round(p.r * 0.32) + "px system-ui";
        ctx.fillText("MAGNET", 0, p.r * 2.9);
      }

      ctx.restore();

      ctx.globalAlpha = 1;
    }

    function drawCheese(x, y, r) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(game.time * 4) * 0.08);
      ctx.fillStyle = "#ffd84d";
      ctx.strokeStyle = "#5f4216";
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.78);
      ctx.lineTo(r * 0.95, r * 0.45);
      ctx.lineTo(-r * 0.25, -r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f2ad34";
      [[-0.28, 0.2, 0.18], [0.26, 0.28, 0.14], [-0.15, -0.32, 0.12]].forEach(hole => {
        ctx.beginPath();
        ctx.arc(hole[0] * r, hole[1] * r, hole[2] * r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#2b241b";
      ctx.beginPath();
      ctx.arc(-r * 0.19, -r * 0.05, r * 0.065, 0, Math.PI * 2);
      ctx.arc(r * 0.23, -r * 0.12, r * 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2b241b";
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.beginPath();
      ctx.arc(r * 0.05, r * 0.05, r * 0.22, 0.15, Math.PI - 0.15);
      ctx.stroke();
      ctx.restore();
    }

    function drawEnemies() {
      for (const enemy of game.enemies) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        drawBarricade(enemy);
        ctx.restore();
      }
    }

    function drawBarricade(enemy) {
      if (enemy.type === "smallCat") {
        drawSmallCatEnemy(enemy);
        return;
      }
      if (enemy.type === "lava") {
        drawLava(enemy);
        return;
      }
      const w = enemy.w;
      const h = enemy.h;
      if (enemy.type === "highWall") {
        ctx.save();
        ctx.translate(0, -h);
        ctx.fillStyle = "#2b3440";
        ctx.strokeStyle = "#e7edf5";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(-w * 0.62, -22, w * 1.24, 24, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 248, 223, 0.95)";
        ctx.font = "900 " + Math.round(Math.max(12, enemy.r * 0.22)) + "px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("CEILING", 0, -10);
        ctx.restore();
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(0, 8, w * 0.6, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      const wallGradient = ctx.createLinearGradient(0, -h, 0, 0);
      wallGradient.addColorStop(0, enemy.type === "highWall" ? "#8793a0" : "#737f8c");
      wallGradient.addColorStop(1, enemy.type === "highWall" ? "#4b5562" : "#3e4854");
      ctx.fillStyle = wallGradient;
      ctx.strokeStyle = "#e7edf5";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 3;
      const brickH = Math.max(18, enemy.r * 0.32);
      for (let y = -h + brickH; y < -4; y += brickH) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 6, y);
        ctx.lineTo(w / 2 - 6, y);
        ctx.stroke();
      }
      for (let y = -h; y < -brickH; y += brickH) {
        const offset = Math.floor((y + h) / brickH) % 2 ? 0 : brickH * 0.75;
        for (let x = -w / 2 + offset; x < w / 2; x += brickH * 1.5) {
          ctx.beginPath();
          ctx.moveTo(x, y + 4);
          ctx.lineTo(x, Math.min(0, y + brickH - 2));
          ctx.stroke();
        }
      }

      ctx.fillStyle = enemy.type === "highWall" ? "#56b6ff" : "#ff5d73";
      ctx.beginPath();
      ctx.roundRect(-w * 0.38, -h * 0.66, w * 0.76, Math.max(34, h * 0.24), 8);
      ctx.fill();
      ctx.fillStyle = "#fff8df";
      ctx.font = "900 " + Math.round(Math.max(18, enemy.r * 0.38)) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(enemy.type === "highWall" ? "DUCK" : "JUMP", 0, -h * 0.54);
    }

    function drawLava(enemy) {
      const w = enemy.w;
      const h = enemy.h * 2.15;
      const lip = Math.max(12, enemy.r * 0.2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
      ctx.beginPath();
      ctx.ellipse(0, 7, w * 0.56, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#14181f";
      ctx.strokeStyle = "#69727d";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -lip * 0.3, w, h, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#202733";
      ctx.beginPath();
      ctx.roundRect(-w / 2 + lip, lip, w - lip * 2, h - lip * 1.35, 13);
      ctx.fill();

      const lavaTop = h * 0.48;
      const lavaGradient = ctx.createLinearGradient(0, lavaTop - 18, 0, h);
      lavaGradient.addColorStop(0, "#ffef5e");
      lavaGradient.addColorStop(0.35, "#ff8b1f");
      lavaGradient.addColorStop(1, "#d92b12");
      ctx.fillStyle = lavaGradient;
      ctx.strokeStyle = "#5c130c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + lip * 1.45, lavaTop, w - lip * 2.9, h * 0.35, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff8df";
      ctx.font = "900 " + Math.round(Math.max(14, enemy.r * 0.35)) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LAVA", 0, -22);

      ctx.fillStyle = "#fff8df";
      ctx.font = "900 " + Math.round(Math.max(13, enemy.r * 0.28)) + "px system-ui";
      ctx.fillText("JUMP THE GAP", 0, h * 0.32);

      ctx.strokeStyle = "#ffef5e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = -w * 0.46; x <= w * 0.46; x += 22) {
        const y = lavaTop + h * 0.17 + Math.sin(game.time * 9 + x * 0.08) * 7;
        if (x === -w * 0.46) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < 9; i += 1) {
        const x = -w * 0.35 + i * w * 0.087;
        const flameH = 16 + Math.sin(game.time * 8 + i) * 7;
        ctx.fillStyle = i % 2 ? "#ffef5e" : "#ff5d1f";
        ctx.beginPath();
        ctx.moveTo(x, lavaTop + 10);
        ctx.quadraticCurveTo(x - 10, lavaTop - flameH * 0.35, x, lavaTop - flameH);
        ctx.quadraticCurveTo(x + 12, lavaTop - flameH * 0.35, x, lavaTop + 10);
        ctx.fill();
      }
    }

    function drawSmallCatEnemy(enemy) {
      const r = enemy.r;
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(0, 8, enemy.w * 0.45, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.strokeStyle = "#070707";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(-r * 0.15, -r * 0.5, r * 1.05, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.72, -r * 0.82, r * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.42, -r * 1.12);
      ctx.lineTo(r * 0.55, -r * 1.55);
      ctx.lineTo(r * 0.76, -r * 1.14);
      ctx.moveTo(r * 0.92, -r * 1.14);
      ctx.lineTo(r * 1.16, -r * 1.5);
      ctx.lineTo(r * 1.18, -r * 1.02);
      ctx.fill();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.72);
      ctx.bezierCurveTo(-r * 1.45, -r * 1.25, -r * 1.2, -r * 1.65, -r * 0.74, -r * 1.35);
      ctx.stroke();
      ctx.fillStyle = "#e4c66a";
      ctx.beginPath();
      ctx.ellipse(r * 0.6, -r * 0.86, r * 0.09, r * 0.15, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.84, -r * 0.86, r * 0.09, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8df";
      ctx.font = "900 " + Math.round(r * 0.42) + "px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("SHOOT", 0, -r * 2.0);
    }

    function drawProjectiles() {
      for (const projectile of game.projectiles) {
        ctx.save();
        ctx.translate(projectile.x, projectile.y);
        ctx.rotate(projectile.spin);
        if (projectile.type === "lipstick") {
          ctx.fillStyle = "#111";
          ctx.fillRect(-projectile.r * 1.3, -projectile.r * 0.45, projectile.r * 1.0, projectile.r * 0.9);
          ctx.fillStyle = "#ff2f87";
          ctx.beginPath();
          ctx.roundRect(-projectile.r * 0.25, -projectile.r * 0.5, projectile.r * 2.0, projectile.r, projectile.r * 0.25);
          ctx.fill();
        } else {
          ctx.fillStyle = "#ffc0dd";
          ctx.beginPath();
          ctx.arc(0, 0, projectile.r * 1.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ff5d9e";
          ctx.beginPath();
          ctx.arc(projectile.r * 0.2, -projectile.r * 0.15, projectile.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function drawFallbackFace(x, y, r) {
      ctx.fillStyle = "#ff6d7f";
      ctx.strokeStyle = "#fff8df";
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#101720";
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.12, r * 0.11, 0, Math.PI * 2);
      ctx.arc(x + r * 0.28, y - r * 0.12, r * 0.11, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.strokeStyle = "#101720";
      ctx.beginPath();
      ctx.arc(x, y + r * 0.24, r * 0.35, Math.PI + 0.2, Math.PI * 2 - 0.2);
      ctx.stroke();
    }

    function drawTreats() {
      for (const treat of game.treats) {
        const y = treat.y + Math.sin(treat.bob) * 5;
        const img = getTreatImage(treat.type);
        if (treat.type !== "coin") {
          ctx.save();
          ctx.globalAlpha = 0.34;
          ctx.fillStyle = getTreatColor(treat.type);
          ctx.beginPath();
          ctx.arc(treat.x, y, treat.r * 1.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (img.loaded) {
          const size = getTreatDrawSize(treat);
          drawRoundImage(img, treat.x, y, size.w, size.h, size.radius);
        } else if (treat.type === "cookie") {
          drawCookie(treat.x, y, treat.r);
        } else if (treat.type === "chocolate") {
          drawChocolate(treat.x, y, treat.r);
        } else if (treat.type === "seafood") {
          drawSeafood(treat.x, y, treat.r);
        } else {
          drawCoin(treat.x, y, treat.r);
        }
        if (treat.type !== "coin") drawPowerupLabel(treat.x, y, treat);
      }
    }

    function drawCoins() {
      for (const coin of game.coins) {
        drawCoin(coin.x, coin.y + Math.sin(coin.bob) * 5, coin.r);
      }
    }

    function getTreatImage(type) {
      if (type === "cookie") return images.cookie;
      if (type === "chocolate") return images.chocolate;
      if (type === "seafood") return images.seafood;
      return images.coin;
    }

    function getTreatDrawSize(treat) {
      if (treat.type === "cookie") return { w: treat.r * 4.25, h: treat.r * 1.72, radius: treat.r * 0.32 };
      if (treat.type === "chocolate") return { w: treat.r * 4.75, h: treat.r * 1.72, radius: treat.r * 0.36 };
      if (treat.type === "seafood") return { w: treat.r * 3.15, h: treat.r * 3.15, radius: treat.r * 0.42 };
      return { w: treat.r * 2.2, h: treat.r * 2.2, radius: treat.r * 0.3 };
    }

    function drawPowerupLabel(x, y, treat) {
      const label = treat.type === "cookie" ? "SHIELD" : treat.type === "chocolate" ? "SPEED" : "MAGNET";
      const color = getTreatColor(treat.type);
      ctx.save();
      ctx.font = "900 " + Math.round(Math.max(12, treat.r * 0.34)) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(label);
      const boxW = metrics.width + 18;
      const boxH = Math.max(22, treat.r * 0.56);
      ctx.fillStyle = "rgba(16, 23, 32, 0.84)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - boxW / 2, y + treat.r * 1.58, boxW, boxH, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff8df";
      ctx.fillText(label, x, y + treat.r * 1.58 + boxH / 2);
      ctx.fillStyle = color;
      ctx.font = "900 " + Math.round(Math.max(11, treat.r * 0.28)) + "px system-ui";
      ctx.fillText("POWERUP", x, y - treat.r * 1.68);
      ctx.restore();
    }

    function drawCoin(x, y, r) {
      ctx.fillStyle = "#ffb32c";
      ctx.strokeStyle = "#fff0a3";
      ctx.lineWidth = Math.max(2, r * 0.15);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#7a4a11";
      ctx.font = "900 " + Math.round(r * 1.2) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", x, y + 1);
    }

    function drawCookie(x, y, r) {
      ctx.fillStyle = "#b9743a";
      ctx.strokeStyle = "#ffd9a4";
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3d261a";
      [[-0.33, -0.14], [0.22, -0.28], [0.3, 0.2], [-0.12, 0.32]].forEach(chip => {
        ctx.beginPath();
        ctx.arc(x + chip[0] * r, y + chip[1] * r, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawChocolate(x, y, r) {
      ctx.fillStyle = "#7653b7";
      ctx.strokeStyle = "#e83a95";
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath();
      ctx.roundRect(x - r * 1.65, y - r * 0.68, r * 3.3, r * 1.36, r * 0.26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 " + Math.round(r * 0.65) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Milka", x, y);
    }

    function drawSeafood(x, y, r) {
      ctx.fillStyle = "#12b9ad";
      ctx.strokeStyle = "#e8fff8";
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.beginPath();
      ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 " + Math.round(r * 0.46) + "px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ZEE", x, y - r * 0.12);
      ctx.fillText("20x", x, y + r * 0.42);
    }

    function drawRoundImage(img, x, y, w, h, radius, alreadyTranslated) {
      ctx.save();
      if (!alreadyTranslated) ctx.translate(x, y);
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

    function loop(now) {
      const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
      lastTime = now;
      update(dt);
      updateSparks(dt);
      draw();
      requestAnimationFrame(loop);
    }

    function setTouchDirection(button, active) {
      const dir = button.dataset.dir;
      if (!dir) return;
      if (active) {
        touchDirs.add(dir);
      } else {
        touchDirs.delete(dir);
      }
    }

    function canvasPointFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (width / rect.width),
        y: (event.clientY - rect.top) * (height / rect.height)
      };
    }

    function setTouchTargetFromEvent(event) {
      if (event.target && event.target.closest && event.target.closest("button")) return;
      event.preventDefault();
      touchTarget.pointerId = event.pointerId;
      jump();
    }

    function clearTouchTarget(event) {
      if (event && touchTarget.pointerId !== null && event.pointerId !== touchTarget.pointerId) return;
      touchTarget.active = false;
      touchTarget.pointerId = null;
    }

    function bindPress(element, action) {
      let lastPress = 0;

      function run(event) {
        if (event) event.preventDefault();
        const now = performance.now();
        if (now - lastPress < 240) return;
        lastPress = now;
        action();
      }

      element.addEventListener("click", run);
      element.addEventListener("pointerup", run);
      element.addEventListener("touchend", run, { passive: false });
    }

    function bindEvents() {
      window.addEventListener("resize", resizeCanvas);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", resizeCanvas);
      }

      window.addEventListener("keydown", event => {
        const key = event.key.toLowerCase();
        if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", "f"].includes(key)) {
          event.preventDefault();
          keys.add(key);
          if (state === "menu") startGame();
          if (key === "arrowup" || key === "w") jump();
          if (key === "arrowdown" || key === "s") game.player.ducking = true;
          if (key === "f") shoot();
        }
        if (key === " " && state !== "playing") {
          event.preventDefault();
          startGame();
        } else if (key === " ") {
          event.preventDefault();
          jump();
        }
      }, { passive: false });

      window.addEventListener("keyup", event => {
        const key = event.key.toLowerCase();
        keys.delete(key);
        if (key === "arrowdown" || key === "s") game.player.ducking = false;
      });

      bindPress(document.getElementById("startButton"), startGame);
      bindPress(document.getElementById("restartButton"), startGame);
      bindPress(document.getElementById("menuButton"), () => {
        state = "menu";
        gameOverOverlay.hidden = true;
        startOverlay.hidden = false;
      });
      bindPress(document.getElementById("howButton"), () => {
        tips.hidden = !tips.hidden;
      });
      bindPress(musicButton, toggleMusic);

      document.querySelectorAll(".map-option").forEach(button => {
        bindPress(button, () => {
          selectedMap = button.dataset.map || "stad";
          document.querySelectorAll(".map-option").forEach(option => option.classList.remove("active"));
          button.classList.add("active");
          statusText.textContent = "Map gekozen: " + button.textContent;
        });
      });

      canvas.addEventListener("pointerdown", event => {
        setTouchTargetFromEvent(event);
        if (event.pointerId !== undefined) canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointerup", clearTouchTarget);
      canvas.addEventListener("pointercancel", clearTouchTarget);
      canvas.addEventListener("pointerleave", clearTouchTarget);

      document.querySelectorAll(".touch-controls button").forEach(button => {
        button.addEventListener("pointerdown", event => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          setTouchDirection(button, true);
          if (state === "menu") startGame();
          if (button.dataset.dir === "up") jump();
          if (button.dataset.dir === "duck") game.player.ducking = true;
          if (button.dataset.dir === "fire") shoot();
        });
        button.addEventListener("pointerup", () => {
          setTouchDirection(button, false);
          if (button.dataset.dir === "duck") game.player.ducking = false;
        });
        button.addEventListener("pointercancel", () => {
          setTouchDirection(button, false);
          if (button.dataset.dir === "duck") game.player.ducking = false;
        });
        button.addEventListener("pointerleave", () => {
          setTouchDirection(button, false);
          if (button.dataset.dir === "duck") game.player.ducking = false;
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

    highScoreText.textContent = String(highScore);
    loadAssets();
    bindEvents();
    resizeCanvas();
    resetGame();
    requestAnimationFrame(loop);
