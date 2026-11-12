const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const wordTargetEl = document.getElementById('word-target');
const actionPromptEl = document.getElementById('action-prompt');
const playerHpEl = document.getElementById('player-hp');
const playerSpEl = document.getElementById('player-sp');
const enemyHpEl = document.getElementById('enemy-hp');
const enemySpEl = document.getElementById('enemy-sp');
const timerEl = document.getElementById('round-timer');
const wpmEl = document.getElementById('wpm-val');
const accEl = document.getElementById('acc-val');
const currentModeLabel = document.getElementById('current-mode-label');
const cHitboxLog = document.getElementById('c-hitbox-log');
const cDamageLog = document.getElementById('c-damage-log');

const menuOverlay = document.getElementById('menu-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnPause = document.getElementById('btn-pause');
const diffBtns = document.querySelectorAll('.diff-btn');

let currentDifficulty = 'MEDIUM';
let computerAttackInterval = 130;
let computerDamage = 9;

// Strict C-Engine Dependency Check on Startup
let cEngineConfig = null;
const btnStartOriginalText = btnStart.innerText;
btnStart.disabled = true;

fetch('c_engine_bridge.json')
  .then(response => {
    if (!response.ok) throw new Error("C-Engine bridge file missing!");
    return response.json();
  })
  .then(data => {
    if (data.engineStatus !== "ONLINE") throw new Error("C-Engine offline!");
    cEngineConfig = data;
    
    player.hp = cEngineConfig.playerMaxHp;
    enemy.hp = cEngineConfig.enemyMaxHp;
    
    const ptrEl = document.querySelector('#c-telemetry span');
    if (ptrEl) ptrEl.innerText = `[C-STRUCT] Fighter* ptr: ${cEngineConfig.cMemoryPointer}`;

    btnStart.disabled = false;
    btnStart.innerText = "START BATTLE";
    btnStart.style.background = "#00f0ff";
    wordTargetEl.innerText = "READY...";
  })
  .catch(err => {
    console.error(err);
    btnStart.disabled = true;
    btnStart.innerText = "ERROR: RUN main.c FIRST";
    btnStart.style.background = "#ff0055";
    btnStart.style.color = "#fff";
    wordTargetEl.innerHTML = `<span style="color:#ff0055; font-size:15px;">[CRITICAL] C-ENGINE OFFLINE — COMPILE & RUN main.c TO UNLOCK</span>`;
  });

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDifficulty = btn.getAttribute('data-diff');
    if (currentDifficulty === 'EASY') {
      computerAttackInterval = 190;
      computerDamage = 5;
    } else if (currentDifficulty === 'MEDIUM') {
      computerAttackInterval = 130;
      computerDamage = 9;
    } else if (currentDifficulty === 'HARD') {
      computerAttackInterval = 75;
      computerDamage = 13;
    }
    currentModeLabel.innerText = currentDifficulty;
  });
});

// Sound Generator
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  if (type === 'key') {
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.04);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
    osc.start(now);
    osc.stop(now + 0.04);
  } else if (type === 'hit') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'canon') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'error') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

// Difficulty Word & Sentence Pools (Fighting Theme)
const EASY_WORDS = [
  "PUNCH", "KICK", "STRIKE", "BLOCK", "JUMP", "DODGE", "SLASH", 
  "PARRY", "BLAST", "DASH", "SWIFT", "GUARD", "CLASH", "RUSH"
];

const MEDIUM_SENTENCES = [
  "QUICK STRIKE", "FIERY PUNCH", "SHADOW KICK", "IRON BLOCK", 
  "ENERGY BEAM", "SWIFT COUNTER", "BLAZING SLASH", "FURY COMBO"
];

const HARD_SENTENCES = [
  "UNLEASH THE ULTIMATE ENERGY BLAST", "STRIKE FAST AND DEFEND YOUR GROUND", 
  "EXECUTE A PERFECT COUNTER ATTACK", "BREAK THE ENEMY DEFENSE WITH FURY"
];

let gameState = 'MENU';
let currentWord = "PUNCH";
let typedIndex = 0;

let totalTypedKeys = 0;
let correctTypedKeys = 0;
let startTime = 0;
let combo = 0;
let maxCombo = 0;
let roundTime = 60;
let timerInterval;

let particles = [];
let energyBeams = [];
let impactFlashes = [];
let groundCraters = [];
let backgroundDust = [];
let screenShake = 0;
let cinematicBlastActive = false;

for (let i = 0; i < 30; i++) {
  backgroundDust.push({
    x: Math.random() * 900,
    y: Math.random() * 320,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.5 + 0.2,
    alpha: Math.random() * 0.5 + 0.1
  });
}

const player = { 
  baseX: 250, x: 250, y: 320, hp: 100, sp: 0, 
  state: 'idle', animTimer: 0, color: '#00f0ff', targetX: 250, arcHeight: 0, breath: 0, scarfWave: 0 
};

const enemy = { 
  baseX: 650, x: 650, y: 320, hp: 100, sp: 0, 
  state: 'idle', animTimer: 0, color: '#ff0055', attackTimer: 0, targetX: 650, arcHeight: 0, breath: 0 
};

function generateNewWord() {
  if (gameState !== 'PLAYING') return;
  typedIndex = 0;
  
  if (enemy.hp === 1) {
    cinematicBlastActive = true;
    currentWord = "FINISHINGBLOW";
    actionPromptEl.innerText = "⚡ FINISHING BLOW - TYPE TO OBLITERATE ⚡";
    actionPromptEl.style.background = "#ff0000";
    actionPromptEl.style.color = "#fff";
  } else if (player.sp >= 100) {
    currentWord = "ENERGY BLAST";
    actionPromptEl.innerText = "★ SPECIAL READY - TYPE ENERGY BLAST ★";
    actionPromptEl.style.background = "#ffe600";
    actionPromptEl.style.color = "#000";
  } else {
    if (currentDifficulty === 'EASY') {
      currentWord = EASY_WORDS[Math.floor(Math.random() * EASY_WORDS.length)];
    } else if (currentDifficulty === 'MEDIUM') {
      currentWord = MEDIUM_SENTENCES[Math.floor(Math.random() * MEDIUM_SENTENCES.length)];
    } else {
      currentWord = HARD_SENTENCES[Math.floor(Math.random() * HARD_SENTENCES.length)];
    }
    actionPromptEl.innerText = `${currentDifficulty} MODE - COMBAT COMMAND`;
    actionPromptEl.style.background = "#00f0ff";
    actionPromptEl.style.color = "#000";
  }
  updateWordDisplay();
}

function updateWordDisplay() {
  let html = "";
  for (let i = 0; i < currentWord.length; i++) {
    if (i < typedIndex) {
      html += `<span class="char-correct">${currentWord[i]}</span>`;
    } else {
      html += `<span class="char-untyped">${currentWord[i]}</span>`;
    }
  }
  wordTargetEl.innerHTML = html;
}

window.addEventListener('keydown', (e) => {
  if (gameState !== 'PLAYING') return;
  if (e.key.length > 1) return;

  const keyChar = e.key.toUpperCase();
  totalTypedKeys++;
  const targetChar = currentWord[typedIndex];

  if (keyChar === targetChar || (targetChar === ' ' && e.key === ' ')) {
    playSound('key');
    typedIndex++;
    correctTypedKeys++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    if (typedIndex >= currentWord.length) {
      executePlayerAction();
      if (gameState === 'PLAYING') generateNewWord();
    } else {
      updateWordDisplay();
    }
  } else {
    playSound('error');
    combo = 0;
    wordTargetEl.style.transform = "translateX(5px)";
    setTimeout(() => wordTargetEl.style.transform = "translateX(0)", 50);
  }

  updateStats();
});

function executePlayerAction() {
  if (gameState !== 'PLAYING') return;
  const move = currentWord;
  const dist = Math.abs(Math.round(enemy.x - player.x));
  const mult = combo >= 4 ? "1.5x CRIT" : "1.0x";
  
  cHitboxLog.innerText = `[C-HITBOX] abs(x1-x2): ${dist}px | HIT CONFIRMED`;
  cDamageLog.innerText = `[C-FORMULA] Combo: ${combo}x (${mult})`;

  if (cinematicBlastActive) {
    player.state = 'energy blast';
    player.targetX = enemy.x - 80;
    player.animTimer = 80;
    enemy.hp = 0;
    enemy.state = 'falling';
    screenShake = 30;
    
    energyBeams.push({ x: player.x, y: player.y - 50, targetX: enemy.x + 50, color: '#ff00ff', life: 50, width: 25 });
    createImpactFlash(enemy.x, enemy.y - 40, '#ff00ff');
    createParticles(enemy.x, enemy.y - 40, '#ff00ff', 50);
    playSound('canon');
    updateHUD();
    checkGameOver();
    return;
  }

  player.state = 'punching';
  player.animTimer = 45;

  if (move.includes("STRIKE") || move.includes("PUNCH")) {
    player.targetX = enemy.x - 50;
    enemy.hp = Math.max(1, enemy.hp - 16);
    enemy.state = 'falling';
    player.sp = Math.min(100, player.sp + 20);
    createImpactFlash(enemy.x, enemy.y - 40, '#ffd700');
    createParticles(enemy.x, enemy.y - 40, '#00f0ff', 22);
    screenShake = 10;
    playSound('hit');
  } else if (move.includes("KICK") || move.includes("SLASH") || move.includes("BLAST")) {
    player.targetX = enemy.x - 45;
    enemy.hp = Math.max(1, enemy.hp - 24);
    enemy.state = 'falling';
    player.sp = Math.min(100, player.sp + 25);
    createImpactFlash(enemy.x, enemy.y - 40, '#ffd700');
    createParticles(enemy.x, enemy.y - 40, '#00f0ff', 26);
    groundCraters.push({ x: enemy.x, y: 320, life: 60 });
    screenShake = 14;
    playSound('hit');
  } else if (move.includes("ENERGY") || move.includes("ULTIMATE") || move.includes("UNLEASH")) {
    player.state = 'energy blast';
    enemy.hp = Math.max(1, enemy.hp - 35);
    enemy.state = 'falling';
    player.sp = 0;
    energyBeams.push({ x: player.x, y: player.y - 50, targetX: enemy.x, color: '#00f0ff', life: 20, width: 12 });
    createImpactFlash(enemy.x, enemy.y - 40, '#ffd700');
    screenShake = 20;
    playSound('canon');
  } else if (move.includes("BLOCK") || move.includes("PARRY") || move.includes("DEFEND")) {
    player.state = 'blocking';
    player.hp = Math.min(100, player.hp + 12);
    createParticles(player.x, player.y - 40, '#00ff66', 15);
  } else {
    player.targetX = enemy.x - 50;
    enemy.hp = Math.max(1, enemy.hp - 18);
    createImpactFlash(enemy.x, enemy.y - 40, '#ffd700');
    createParticles(enemy.x, enemy.y - 40, '#00f0ff', 16);
    screenShake = 10;
    playSound('hit');
  }

  if (enemy.hp < 15 && enemy.hp > 1) enemy.hp = 1;

  updateHUD();
  checkGameOver();
}

function computerAttack() {
  if (gameState !== 'PLAYING' || cinematicBlastActive) return;

  const enemyMoves = ['punching', 'kicking', 'tackling', 'jumping'];
  enemy.state = enemyMoves[Math.floor(Math.random() * enemyMoves.length)];
  enemy.targetX = player.x + 50;
  enemy.animTimer = 40;

  if (player.state === 'blocking' || player.state === 'dodging') {
    player.hp = Math.max(0, player.hp - 2);
    createParticles(player.x, player.y - 40, '#00ff66', 10);
  } else {
    player.state = 'falling';
    player.hp = Math.max(0, player.hp - computerDamage);
    createImpactFlash(player.x, player.y - 40, '#ff0055');
    createParticles(player.x, player.y - 40, '#ff0055', 18);
    screenShake = 12;
  }

  playSound('hit');
  updateHUD();
  checkGameOver();
}

function updateStats() {
  const elapsedMinutes = (Date.now() - startTime) / 60000;
  const wpm = elapsedMinutes > 0 ? Math.round((correctTypedKeys / 5) / elapsedMinutes) : 0;
  const acc = totalTypedKeys > 0 ? Math.round((correctTypedKeys / totalTypedKeys) * 100) : 100;
  wpmEl.innerText = wpm;
  accEl.innerText = acc;
}

function updateHUD() {
  playerHpEl.style.width = Math.max(0, player.hp) + '%';
  playerSpEl.style.width = Math.max(0, player.sp) + '%';
  enemyHpEl.style.width = Math.max(0, enemy.hp) + '%';
  enemySpEl.style.width = Math.max(0, enemy.sp) + '%';
}

function createParticles(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      life: 30, color: color
    });
  }
}

function createImpactFlash(x, y, color) {
  impactFlashes.push({ x: x, y: y, radius: 10, maxRadius: 50, color: color, alpha: 1 });
}

function drawAnimatedStickman(p, facingRight) {
  ctx.save();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const flip = facingRight ? 1 : -1;
  p.breath += 0.1;
  p.scarfWave += 0.2;
  let breathOffset = Math.sin(p.breath) * 2;

  let headY = p.y - 70 + breathOffset;
  let bodyY = p.y - 20 + breathOffset;

  p.x += (p.targetX - p.x) * 0.18;
  
  if (p.animTimer > 0) {
    p.animTimer--;
    p.arcHeight = Math.sin((p.animTimer / 45) * Math.PI) * 45;
  } else {
    p.arcHeight = 0;
    p.targetX = p.baseX;
  }

  headY -= p.arcHeight;
  bodyY -= p.arcHeight;

  let bodyLean = 0;
  if (p.animTimer > 30) {
    headY += 12; bodyY += 8;
  } else if (p.animTimer > 0 && p.animTimer < 15) {
    headY += 8; bodyY += 5;
    bodyLean = 4 * flip;
  }

  ctx.beginPath();
  ctx.arc(p.x + bodyLean, headY, 12, 0, Math.PI * 2);
  ctx.stroke();

  if (p === player) {
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let scarfStartX = p.x + bodyLean - (8 * flip);
    let scarfStartY = headY + 5;
    ctx.moveTo(scarfStartX, scarfStartY);
    let wave1X = scarfStartX - (25 * flip) + Math.sin(p.scarfWave) * 8;
    let wave1Y = scarfStartY + 10;
    let wave2X = scarfStartX - (50 * flip) + Math.cos(p.scarfWave) * 12;
    let wave2Y = scarfStartY + 20;
    ctx.quadraticCurveTo(wave1X, wave1Y, wave2X, wave2Y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(p.x + bodyLean, headY + 12);
  ctx.lineTo(p.x, bodyY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(p.x + bodyLean, headY + 20);
  ctx.lineTo(p.x - 15 * flip, headY + 35);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(p.x + bodyLean, headY + 20);
  if (p.state.includes('punch') || p.state === 'strike') {
    ctx.lineTo(p.x + 58 * flip, headY + 20);
  } else if (p.state.includes('energy') || p.state === 'powering up') {
    ctx.lineTo(p.x + 35 * flip, headY + 10);
    ctx.lineTo(p.x + 62 * flip, headY + 20);
  } else if (p.state === 'blocking') {
    ctx.lineTo(p.x + 22 * flip, headY - 8);
  } else {
    ctx.lineTo(p.x + 20 * flip, headY + 30);
  }
  ctx.stroke();

  if (p === player) {
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    let handX = p.x + 20 * flip;
    let handY = headY + 30;
    if (p.state.includes('punch')) { handX = p.x + 58 * flip; handY = headY + 20; }
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + 40 * flip, handY - 18);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(p.x, bodyY);
  if (p.state.includes('kick') || p.state === 'flips') {
    ctx.lineTo(p.x + 65 * flip, bodyY - 25);
    ctx.moveTo(p.x, bodyY);
    ctx.lineTo(p.x - 12 * flip, p.y);
  } else if (p.state === 'falling') {
    ctx.lineTo(p.x - 35 * flip, bodyY + 15);
    ctx.moveTo(p.x, bodyY);
    ctx.lineTo(p.x + 25 * flip, bodyY + 20);
  } else {
    ctx.lineTo(p.x - 15 * flip, p.y);
    ctx.moveTo(p.x, bodyY);
    ctx.lineTo(p.x + 15 * flip, p.y);
  }
  ctx.stroke();

  ctx.restore();
}

function checkGameOver() {
  if (gameState !== 'PLAYING') return;
  
  if (player.hp <= 0 || enemy.hp <= 0 || roundTime <= 0) {
    gameState = 'GAME_OVER';
    clearInterval(timerInterval);
    gameoverOverlay.classList.remove('hidden');

    const winText = document.getElementById('winner-text');
    if (player.hp > enemy.hp || enemy.hp <= 0) {
      winText.innerText = "VICTORY!";
      winText.style.color = "#00ff66";
      player.state = 'victory';
      enemy.state = 'falling';
    } else {
      winText.innerText = "DEFEAT!";
      winText.style.color = "#ff0055";
      player.state = 'falling';
      enemy.state = 'victory';
    }

    document.getElementById('final-wpm').innerText = wpmEl.innerText;
    document.getElementById('final-acc').innerText = accEl.innerText + "%";
    document.getElementById('final-combo').innerText = maxCombo;
  }
}

function renderBackground() {
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }

  for (let dust of backgroundDust) {
    dust.y -= dust.speed;
    if (dust.y < 0) dust.y = 320;
    ctx.fillStyle = `rgba(0, 240, 255, ${dust.alpha})`;
    ctx.beginPath();
    ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gameLoop() {
  ctx.save();
  
  if (screenShake > 0) {
    let shakeX = (Math.random() - 0.5) * screenShake;
    let shakeY = (Math.random() - 0.5) * screenShake;
    ctx.translate(shakeX, shakeY);
    screenShake *= 0.82;
    if (screenShake < 0.5) screenShake = 0;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderBackground();

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, 320);
  ctx.lineTo(900, 320);
  ctx.stroke();
  ctx.shadowBlur = 0;

  for (let i = groundCraters.length - 1; i >= 0; i--) {
    let c = groundCraters[i];
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 30, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    c.life--;
    if (c.life <= 0) groundCraters.splice(i, 1);
  }

  if (gameState === 'PLAYING' && !cinematicBlastActive) {
    enemy.attackTimer++;
    if (enemy.attackTimer > computerAttackInterval) {
      computerAttack();
      enemy.attackTimer = 0;
    }
  }

  for (let i = energyBeams.length - 1; i >= 0; i--) {
    let b = energyBeams[i];
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.width || 12;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(b.x + 20, b.y);
    ctx.lineTo(b.targetX, b.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    b.life--;
    if (b.life <= 0) {
      energyBeams.splice(i, 1);
      if (cinematicBlastActive) checkGameOver();
    }
  }

  for (let i = impactFlashes.length - 1; i >= 0; i--) {
    let f = impactFlashes[i];
    f.radius += 4;
    f.alpha -= 0.08;
    ctx.save();
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = Math.max(0, f.alpha);
    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      let rayLen = f.radius * (angle % 2 === 0 ? 1.5 : 0.8);
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + Math.cos(angle) * rayLen, f.y + Math.sin(angle) * rayLen);
    }
    ctx.stroke();
    ctx.restore();
    if (f.alpha <= 0) impactFlashes.splice(i, 1);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    if (p.life <= 0) particles.splice(i, 1);
  }

  drawAnimatedStickman(player, true);
  drawAnimatedStickman(enemy, false);

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  player.hp = cEngineConfig ? cEngineConfig.playerMaxHp : 100;
  player.sp = 0;
  enemy.hp = cEngineConfig ? cEngineConfig.enemyMaxHp : 100;
  enemy.sp = 0;
  player.x = 250; player.baseX = 250; player.targetX = 250;
  enemy.x = 650; enemy.baseX = 650; enemy.targetX = 650;
  player.state = 'idle';
  enemy.state = 'idle';
  totalTypedKeys = 0;
  correctTypedKeys = 0;
  combo = 0;
  maxCombo = 0;
  roundTime = 60;
  cinematicBlastActive = false;
  startTime = Date.now();
  gameState = 'PLAYING';

  updateHUD();
  menuOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');

  generateNewWord();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState === 'PLAYING' && !cinematicBlastActive) {
      roundTime--;
      timerEl.innerText = roundTime;
      if (roundTime <= 0) checkGameOver();
    }
  }, 1000);
}

function returnToMenu() {
  clearInterval(timerInterval);
  gameState = 'MENU';
  menuOverlay.classList.remove('hidden');
  gameoverOverlay.classList.add('hidden');
}

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', returnToMenu);
btnPause.addEventListener('click', returnToMenu);

requestAnimationFrame(gameLoop);