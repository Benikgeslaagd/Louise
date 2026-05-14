"use strict";

    // Vervang deze bestandsnamen door je eigen foto's. Zet de bestanden naast index.html.
    // Voor het meisje uit je foto: maak een vierkante uitsnede van haar gezicht en noem die gezicht1.png.
    const ASSET_FILES = {
      player: "speler.png",
      faces: ["gezicht1.png"],
      coin: "munt.png",
      cookie: "koek.png",
      chocolate: "chocolade.png",
      seafood: "zeevruchten.png"
    };

    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreText = document.getElementById("scoreText");
    const highScoreText = document.getElementById("highScoreText");
    const livesText = document.getElementById("livesText");
    const statusText = document.getElementById("statusText");
    const musicButton = document.getElementById("musicButton");
    const startOverlay = document.getElementById("startOverlay");
    const gameOverOverlay = document.getElementById("gameOverOverlay");
    const gameOverText = document.getElementById("gameOverText");
    const tips = document.getElementById("tips");

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
    let shake = 0;
    let highScore = Number(localStorage.getItem("kaasChaosHighScore") || 0);
    let audioContext = null;
    let musicTimer = null;
    let musicStep = 0;
    let musicEnabled = localStorage.getItem("kaasChaosMusic") !== "off";

    const game = {
      score: 0,
      lives: 3,
      time: 0,
      player: { x: 0, y: 0, r: 28, speed: 300, invincible: 0, powerTime: 0, magnetTime: 0 },
      enemies: [],
      treats: []
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
      touchDirs.clear();
      touchTarget.active = false;
      spawnTimer = 0;
      treatTimer = 0;
      shake = 0;
      game.player.r = Math.max(22, Math.min(34, width * 0.034));
      game.player.speed = Math.max(250, Math.min(380, width * 0.34));
      game.player.x = width * 0.24;
      game.player.y = height * 0.56;
      game.player.invincible = 1.2;
      game.player.powerTime = 0;
      game.player.magnetTime = 0;
      addTreat("coin", true);
      addTreat("cookie", true);
      addTreat("chocolate", true);
      addTreat("seafood", true);
      updateHud();
    }

    function startGame() {
      resetGame();
      state = "playing";
      startOverlay.hidden = true;
      gameOverOverlay.hidden = true;
      statusText.textContent = "Pak koek. Ontwijk gezichten.";
      if (musicEnabled) startMusic();
      lastTime = performance.now();
    }

    function endGame() {
      state = "gameover";
      highScore = Math.max(highScore, game.score);
      localStorage.setItem("kaasChaosHighScore", String(highScore));
      gameOverText.textContent = "Je score: " + game.score + " | Highscore: " + highScore;
      gameOverOverlay.hidden = false;
      updateHud();
    }

    function updateHud() {
      scoreText.textContent = String(game.score);
      highScoreText.textContent = String(highScore);
      livesText.textContent = String(game.lives);
      musicButton.textContent = musicEnabled ? "Muziek uit" : "Muziek aan";
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
      if (!ensureAudioContext()) return;
      if (musicTimer) return;
      tickMusic();
      musicTimer = window.setInterval(tickMusic, 185);
    }

    function stopMusic() {
      if (musicTimer) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    }

    function toggleMusic() {
      musicEnabled = !musicEnabled;
      localStorage.setItem("kaasChaosMusic", musicEnabled ? "on" : "off");
      if (musicEnabled) {
        startMusic();
      } else {
        stopMusic();
      }
      updateHud();
    }

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function clampPlayer() {
      if (!game.player) return;
      const r = game.player.r || 26;
      game.player.x = Math.min(width * 0.52, Math.max(width * 0.12, game.player.x || width * 0.24));
      game.player.y = Math.min(height - r, Math.max(r, game.player.y || height / 2));
    }

    function addEnemy() {
      const r = randomBetween(22, Math.max(34, Math.min(54, width * 0.05)));
      const speed = getWorldSpeed() + randomBetween(35, 95);
      game.enemies.push({
        x: width + r + randomBetween(0, width * 0.28),
        y: randomBetween(82, height - r - 28),
        r,
        vx: -speed,
        vy: randomBetween(-28, 28),
        spin: randomBetween(-2.2, 2.2),
        angle: randomBetween(0, Math.PI * 2),
        imageIndex: Math.floor(Math.random() * images.faces.length)
      });
    }

    function getWorldSpeed() {
      return Math.min(360, 155 + game.time * 5.5);
    }

    function addTreat(type, visibleNow) {
      const treatData = {
        coin: { r: 15, value: 25 },
        cookie: { r: 25, value: 75 },
        chocolate: { r: 27, value: 100 },
        seafood: { r: 28, value: 125 }
      };
      const data = treatData[type] || treatData.coin;
      game.treats.push({
        type,
        x: visibleNow ? randomBetween(width * 0.48, width - 42) : width + randomBetween(30, width * 0.45),
        y: randomBetween(88, height - 48),
        r: data.r,
        value: data.value,
        vx: -getWorldSpeed(),
        bob: randomBetween(0, Math.PI * 2)
      });
    }

    function randomTreatType() {
      const roll = Math.random();
      if (roll < 0.12) return "seafood";
      if (roll < 0.28) return "chocolate";
      if (roll < 0.50) return "cookie";
      return "coin";
    }

    function getInputVector() {
      let x = 0;
      let y = 0;
      if (keys.has("arrowleft") || keys.has("a") || touchDirs.has("left")) x -= 1;
      if (keys.has("arrowright") || keys.has("d") || touchDirs.has("right")) x += 1;
      if (keys.has("arrowup") || keys.has("w") || touchDirs.has("up")) y -= 1;
      if (keys.has("arrowdown") || keys.has("s") || touchDirs.has("down")) y += 1;

      if (touchTarget.active) {
        const dx = touchTarget.x - game.player.x;
        const dy = touchTarget.y - game.player.y;
        const targetDistance = Math.hypot(dx, dy);
        if (targetDistance > game.player.r * 0.45) {
          x += dx / targetDistance;
          y += dy / targetDistance;
        }
      }

      const len = Math.hypot(x, y);
      if (len > 0) {
        x /= len;
        y /= len;
      }
      return { x, y };
    }

    function update(dt) {
      if (state !== "playing") return;

      game.time += dt;
      spawnTimer -= dt;
      treatTimer -= dt;
      shake = Math.max(0, shake - dt * 20);
      game.player.invincible = Math.max(0, game.player.invincible - dt);
      game.player.powerTime = Math.max(0, game.player.powerTime - dt);
      game.player.magnetTime = Math.max(0, game.player.magnetTime - dt);

      const input = getInputVector();
      const powerBoost = game.player.powerTime > 0 ? 1.22 : 1;
      game.player.x += input.x * game.player.speed * 0.72 * powerBoost * dt;
      game.player.y += input.y * game.player.speed * dt;
      clampPlayer();

      if (spawnTimer <= 0) {
        addEnemy();
        spawnTimer = Math.max(0.26, 1.05 - game.time * 0.015);
      }

      if (treatTimer <= 0 || game.treats.length < 4) {
        addTreat(randomTreatType());
        treatTimer = randomBetween(0.75, 1.35);
      }

      for (const enemy of game.enemies) {
        enemy.vx = -getWorldSpeed() - enemy.r * 0.45;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.angle += enemy.spin * dt;
        if (enemy.y < enemy.r + 62 || enemy.y > height - enemy.r - 10) enemy.vy *= -1;
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

      collectTreats();
      checkEnemyHits();
      updateHud();
    }

    function collectTreats() {
      for (let i = game.treats.length - 1; i >= 0; i -= 1) {
        const treat = game.treats[i];
        const dist = Math.hypot(game.player.x - treat.x, game.player.y - treat.y);
        if (dist < game.player.r + treat.r) {
          game.score += treat.value;
          applyPowerup(treat.type);
          game.treats.splice(i, 1);
          statusText.textContent = getTreatMessage(treat.type);
          addSpark(treat.x, treat.y, getTreatColor(treat.type));
        }
      }
    }

    function applyPowerup(type) {
      if (type === "cookie") {
        game.player.invincible = Math.max(game.player.invincible, 1.6);
      } else if (type === "chocolate") {
        game.player.powerTime = 4.2;
      } else if (type === "seafood") {
        game.player.magnetTime = 5.5;
        game.player.invincible = Math.max(game.player.invincible, 1.1);
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
      if (game.player.invincible > 0) return;

      for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = game.enemies[i];
        const dist = Math.hypot(game.player.x - enemy.x, game.player.y - enemy.y);
        if (dist < game.player.r + enemy.r * 0.78) {
          game.lives -= 1;
          game.player.invincible = 1.1;
          shake = 10;
          game.enemies.splice(i, 1);
          statusText.textContent = "Oef. Dat gezicht was te dichtbij.";
          if (game.lives <= 0) {
            endGame();
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
      drawTreats();
      drawEnemies();
      drawPlayer();
      drawSparks();
      ctx.restore();
    }

    function drawBackground() {
      const grid = Math.max(34, Math.min(58, width * 0.055));
      ctx.fillStyle = "#111a24";
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

      const roadY = height * 0.78;
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(0, roadY, width, 3);
      ctx.fillRect(0, roadY + 42, width, 2);
      ctx.strokeStyle = "rgba(255, 216, 77, 0.42)";
      ctx.lineWidth = 4;
      const scroll = (game.time * getWorldSpeed() * 0.72) % 110;
      for (let x = -130 - scroll; x < width + 140; x += 110) {
        ctx.beginPath();
        ctx.moveTo(x, roadY + 22);
        ctx.lineTo(x + 54, roadY + 22);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i += 1) {
        const x = (width + 90 - ((game.time * getWorldSpeed() * 0.9 + i * 155) % (width + 220)));
        const y = 94 + ((i * 67) % Math.max(120, height - 180));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 58, y + 5);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255, 216, 77, 0.08)";
      for (let i = 0; i < 16; i += 1) {
        const x = (i * 173 - game.time * getWorldSpeed() * 0.22) % (width + 120) - 60;
        const y = (i * 89 + Math.sin(game.time + i) * 20) % (height + 120) - 60;
        ctx.beginPath();
        ctx.arc(x, y, 6 + (i % 3) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawPlayer() {
      const p = game.player;
      const blink = p.invincible > 0 && Math.floor(p.invincible * 12) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.45;
      const bob = state === "playing" ? Math.sin(game.time * 13) * 4 : 0;
      const lean = state === "playing" ? 0.08 : 0;

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

      if (images.player.loaded) {
        drawRoundImage(images.player, 0, 0, p.r * 2.2, p.r * 2.2, p.r * 0.48, true);
      } else {
        drawCheese(0, 0, p.r);
      }

      if (game.player.magnetTime > 0) {
        ctx.strokeStyle = "rgba(18, 214, 200, 0.72)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 1.38, 0, Math.PI * 2);
        ctx.stroke();
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
        const img = images.faces[enemy.imageIndex];
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.angle);
        if (img && img.loaded) {
          drawRoundImage(img, 0, 0, enemy.r * 2.1, enemy.r * 2.1, enemy.r, true);
        } else {
          drawFallbackFace(0, 0, enemy.r);
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
      }
    }

    function getTreatImage(type) {
      if (type === "cookie") return images.cookie;
      if (type === "chocolate") return images.chocolate;
      if (type === "seafood") return images.seafood;
      return images.coin;
    }

    function getTreatDrawSize(treat) {
      if (treat.type === "cookie") return { w: treat.r * 3.8, h: treat.r * 1.65, radius: treat.r * 0.32 };
      if (treat.type === "chocolate") return { w: treat.r * 4.15, h: treat.r * 1.55, radius: treat.r * 0.36 };
      if (treat.type === "seafood") return { w: treat.r * 2.65, h: treat.r * 2.65, radius: treat.r * 0.42 };
      return { w: treat.r * 2.2, h: treat.r * 2.2, radius: treat.r * 0.3 };
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
      if (state !== "playing") return;
      event.preventDefault();
      const point = canvasPointFromEvent(event);
      touchTarget.active = true;
      touchTarget.pointerId = event.pointerId;
      touchTarget.x = Math.min(width - game.player.r, Math.max(game.player.r, point.x));
      touchTarget.y = Math.min(height - game.player.r, Math.max(game.player.r, point.y));
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
        if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key)) {
          event.preventDefault();
          keys.add(key);
          if (state === "menu") startGame();
        }
        if (key === " " && state !== "playing") {
          event.preventDefault();
          startGame();
        }
      }, { passive: false });

      window.addEventListener("keyup", event => {
        keys.delete(event.key.toLowerCase());
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

      canvas.addEventListener("pointerdown", event => {
        setTouchTargetFromEvent(event);
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", event => {
        if (touchTarget.active) setTouchTargetFromEvent(event);
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
        });
        button.addEventListener("pointerup", () => setTouchDirection(button, false));
        button.addEventListener("pointercancel", () => setTouchDirection(button, false));
        button.addEventListener("pointerleave", () => setTouchDirection(button, false));
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
