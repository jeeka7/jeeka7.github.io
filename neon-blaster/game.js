// --- Audio Controller (Web Audio API) ---
var AudioContextClass = (window.AudioContext || window.webkitAudioContext);
var audioCtx = new AudioContextClass();
function playSound(type) {
    if (audioCtx.state === 'suspended')
        audioCtx.resume();
    var oscillator = audioCtx.createOscillator();
    var gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    var now = audioCtx.currentTime;
    switch (type) {
        case 'shoot':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(800, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start();
            oscillator.stop(now + 0.1);
            break;
        case 'damage':
            // Harsh noise for losing a life
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, now);
            oscillator.frequency.linearRampToValueAtTime(50, now + 0.2);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
            oscillator.start();
            oscillator.stop(now + 0.2);
            break;
        case 'explode':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, now);
            oscillator.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start();
            oscillator.stop(now + 0.3);
            break;
        case 'powerup':
            // Nice magical chime
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, now);
            oscillator.frequency.linearRampToValueAtTime(1200, now + 0.3);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
            oscillator.start();
            oscillator.stop(now + 0.3);
            break;
        case 'highscore':
        case 'levelup':
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(523.25, now);
            oscillator.frequency.setValueAtTime(659.25, now + 0.1);
            oscillator.frequency.setValueAtTime(783.99, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
            oscillator.start();
            oscillator.stop(now + 0.6);
            break;
    }
}
// --- Configuration ---
var CANVAS_WIDTH = 600;
var CANVAS_HEIGHT = 800;
var PLAYER_SIZE = 30;
var ENEMY_SIZE = 40;
var POWERUP_SIZE = 25;
var BULLET_WIDTH = 5;
var BULLET_HEIGHT = 15;
var PLAYER_SPEED = 7;
var BULLET_SPEED = 10;
var BASE_SPAWN_RATE = 50;
var FRAMES_PER_LEVEL = 3600;
// --- Setup ---
var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
// Game State
var isGameOver = false;
var score = 0;
var level = 1;
var lives = 3;
var highScore = parseInt(localStorage.getItem('neonBlasterHighScore') || '0');
// Timers & Counters
var frameCount = 0;
var levelUpMessageTimer = 0;
var invulnerableUntil = 0; // Timestamp for iframe after hit
var powerUpActiveUntil = 0; // Timestamp for active powerup
var activePowerUp = null;
var lastShotTime = 0;
// Entities
var enemies = [];
var bullets = [];
var powerups = [];
// Player Object
var player = {
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
    y: CANVAS_HEIGHT - PLAYER_SIZE - 20,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    color: '#00ff00'
};
// Input State
var keys = {};
// --- Input Listeners ---
window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (isGameOver && e.code === 'Enter')
        resetGame();
    if (!isGameOver && e.code === 'Space')
        handleShooting(true);
});
window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
});
// --- Touch Controls ---
function setupMobileControls() {
    var simulateKey = function (code, isDown) {
        keys[code] = isDown;
        if (code === 'Space') {
            if (isGameOver)
                keys['Enter'] = isDown;
            else {
                keys['Space'] = isDown;
                if (isDown)
                    handleShooting(true);
            }
        }
    };
    var bindButton = function (id, code) {
        var btn = document.getElementById(id);
        if (!btn)
            return;
        btn.addEventListener('mousedown', function (e) { e.preventDefault(); simulateKey(code, true); });
        btn.addEventListener('mouseup', function (e) { e.preventDefault(); simulateKey(code, false); });
        btn.addEventListener('mouseleave', function (e) { e.preventDefault(); simulateKey(code, false); });
        btn.addEventListener('touchstart', function (e) { e.preventDefault(); simulateKey(code, true); }, { passive: false });
        btn.addEventListener('touchend', function (e) { e.preventDefault(); simulateKey(code, false); });
    };
    bindButton('btnLeft', 'ArrowLeft');
    bindButton('btnRight', 'ArrowRight');
    bindButton('btnShoot', 'Space');
}
setupMobileControls();
// --- Game Logic ---
function resetGame() {
    isGameOver = false;
    score = 0;
    level = 1;
    lives = 3;
    frameCount = 0;
    activePowerUp = null;
    invulnerableUntil = 0;
    enemies = [];
    bullets = [];
    powerups = [];
    player.x = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
    loop();
}
function handleShooting(instant) {
    var now = Date.now();
    // Determine Fire Rate based on Power Up
    var cooldown = 200; // Default
    if (activePowerUp === 'RAPID_FIRE')
        cooldown = 50; // Super fast
    if (now - lastShotTime > cooldown) {
        if (activePowerUp === 'TRIPLE_SHOT') {
            // Center Bullet
            createBullet(0);
            // Left Angled
            createBullet(-2);
            // Right Angled
            createBullet(2);
        }
        else {
            // Standard Single Shot
            createBullet(0);
        }
        playSound('shoot');
        lastShotTime = now;
    }
}
function createBullet(vx) {
    bullets.push({
        x: player.x + PLAYER_SIZE / 2 - BULLET_WIDTH / 2,
        y: player.y,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        color: '#ffff00',
        speed: BULLET_SPEED,
        vx: vx
    });
}
function spawnEntities() {
    // 1. Spawn Enemies
    var currentSpawnRate = Math.max(20, BASE_SPAWN_RATE - (level * 5));
    if (frameCount % currentSpawnRate === 0) {
        var xPos = Math.random() * (CANVAS_WIDTH - ENEMY_SIZE);
        var enemySpeed = 3 + (level * 0.5);
        enemies.push({
            x: xPos,
            y: -ENEMY_SIZE,
            width: ENEMY_SIZE,
            height: ENEMY_SIZE,
            color: '#ff0055',
            speed: enemySpeed
        });
    }
    // 2. Spawn Power Ups (Roughly every 15 seconds)
    // 60fps * 15s = 900 frames
    if (frameCount % 900 === 0 && frameCount > 100) {
        var xPos = Math.random() * (CANVAS_WIDTH - POWERUP_SIZE);
        var rand = Math.random();
        var type = 'RAPID_FIRE';
        var color = '#8A2BE2'; // Purple
        if (rand < 0.33) {
            type = 'TRIPLE_SHOT';
            color = '#FFA500'; // Orange
        }
        else if (rand < 0.66) {
            type = 'SHIELD';
            color = '#00FFFF'; // Cyan
        }
        powerups.push({
            x: xPos,
            y: -POWERUP_SIZE,
            width: POWERUP_SIZE,
            height: POWERUP_SIZE,
            color: color,
            speed: 4,
            type: type
        });
    }
}
function checkCollision(rect1, rect2) {
    return (rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y);
}
function takeDamage() {
    var now = Date.now();
    // If shield is active OR we are currently blinking (invulnerable)
    if (activePowerUp === 'SHIELD' || now < invulnerableUntil)
        return;
    lives--;
    playSound('damage');
    if (lives <= 0) {
        isGameOver = true;
        playSound('explode');
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('neonBlasterHighScore', highScore.toString());
            setTimeout(function () { return playSound('highscore'); }, 500);
        }
    }
    else {
        // Give 2 seconds of invulnerability
        invulnerableUntil = now + 2000;
    }
}
function activatePowerUp(type) {
    activePowerUp = type;
    powerUpActiveUntil = Date.now() + 10000; // Lasts 10 seconds
    playSound('powerup');
}
function update() {
    if (isGameOver)
        return;
    var now = Date.now();
    // Check if key is held down (repeater for shooting)
    if (keys['Space'])
        handleShooting(false);
    // Expire PowerUp
    if (activePowerUp && now > powerUpActiveUntil) {
        activePowerUp = null;
    }
    // Level Up Logic
    if (frameCount > 0 && frameCount % FRAMES_PER_LEVEL === 0) {
        level++;
        playSound('levelup');
        levelUpMessageTimer = 120;
    }
    if (levelUpMessageTimer > 0)
        levelUpMessageTimer--;
    // Move Player
    if ((keys['ArrowLeft'] || keys['KeyA']) && player.x > 0)
        player.x -= PLAYER_SPEED;
    if ((keys['ArrowRight'] || keys['KeyD']) && player.x < CANVAS_WIDTH - player.width)
        player.x += PLAYER_SPEED;
    // Move Bullets
    bullets.forEach(function (bullet) {
        bullet.y -= bullet.speed;
        if (bullet.vx)
            bullet.x += bullet.vx; // Horizontal movement for triple shot
        if (bullet.y < 0 || bullet.x < 0 || bullet.x > CANVAS_WIDTH)
            bullet.toBeRemoved = true;
    });
    // Move & Collide PowerUps
    powerups.forEach(function (p) {
        p.y += p.speed;
        if (checkCollision(player, p)) {
            activatePowerUp(p.type);
            p.toBeRemoved = true;
            score += 50; // Bonus points for pickup
        }
        if (p.y > CANVAS_HEIGHT)
            p.toBeRemoved = true;
    });
    spawnEntities();
    // Move & Collide Enemies
    enemies.forEach(function (enemy) {
        enemy.y += enemy.speed || 4;
        // Enemy hits Player
        if (checkCollision(player, enemy)) {
            takeDamage();
            // Destroy enemy on impact? Yes, usually.
            enemy.toBeRemoved = true;
        }
        // Bullet hits Enemy
        bullets.forEach(function (bullet) {
            if (!bullet.toBeRemoved && checkCollision(bullet, enemy)) {
                bullet.toBeRemoved = true;
                enemy.toBeRemoved = true;
                score += 20 * level;
                playSound('explode');
            }
        });
        if (enemy.y > CANVAS_HEIGHT)
            enemy.toBeRemoved = true;
    });
    // Cleanup
    enemies = enemies.filter(function (e) { return !e.toBeRemoved; });
    bullets = bullets.filter(function (b) { return !b.toBeRemoved; });
    powerups = powerups.filter(function (p) { return !p.toBeRemoved; });
    frameCount++;
}
function draw() {
    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Draw Player
    var now = Date.now();
    // Flicker effect if invulnerable
    if (now < invulnerableUntil && Math.floor(now / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    // Draw Shield Visual
    if (activePowerUp === 'SHIELD') {
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 40, 0, Math.PI * 2);
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0; // Reset alpha
    // Draw PowerUps
    powerups.forEach(function (p) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        // Label the powerup
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        var label = 'P';
        if (p.type === 'RAPID_FIRE')
            label = 'R';
        if (p.type === 'TRIPLE_SHOT')
            label = '3';
        if (p.type === 'SHIELD')
            label = 'S';
        ctx.fillText(label, p.x + p.width / 2, p.y + p.height - 8);
    });
    // Draw Bullets
    ctx.shadowBlur = 5;
    bullets.forEach(function (bullet) {
        ctx.fillStyle = bullet.color;
        ctx.shadowColor = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
    // Draw Enemies
    ctx.shadowBlur = 10;
    enemies.forEach(function (enemy) {
        ctx.fillStyle = enemy.color;
        ctx.shadowColor = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    });
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    // UI - Score, Level, Lives
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText("Score: ".concat(score), 20, 30);
    ctx.fillText("Level: ".concat(level), 20, 55);
    // Lives (Draw Hearts)
    var hearts = '';
    for (var i = 0; i < lives; i++)
        hearts += '❤️ ';
    ctx.fillText("Lives: ".concat(hearts), 20, 80);
    // Active Power Up Timer
    if (activePowerUp) {
        var remaining = Math.ceil((powerUpActiveUntil - now) / 1000);
        ctx.fillStyle = 'yellow';
        ctx.fillText("POWERUP: ".concat(activePowerUp, " (").concat(remaining, "s)"), 20, 110);
    }
    ctx.fillStyle = 'white';
    ctx.textAlign = 'right';
    ctx.fillText("High Score: ".concat(highScore), CANVAS_WIDTH - 20, 30);
    // --- VERSION CHECKER ---
    ctx.font = '12px Arial';
    ctx.fillStyle = 'gray';
    ctx.fillText('v2.0', CANVAS_WIDTH - 10, CANVAS_HEIGHT - 10);
    // Level Up Overlay
    if (levelUpMessageTimer > 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'cyan';
        ctx.font = 'bold 40px Arial';
        ctx.fillText("LEVEL ".concat(level, "!"), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100);
    }
    ctx.textAlign = 'left';
    // Game Over Screen
    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = '50px Arial';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);
        ctx.font = '20px Arial';
        ctx.fillText("Final Score: ".concat(score), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
        ctx.fillText('Press ENTER to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
        ctx.textAlign = 'left';
    }
}
function loop() {
    update();
    draw();
    if (!isGameOver)
        requestAnimationFrame(loop);
    else
        draw();
}
loop();
