// game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const IMAGE_DISPLAY_SIZES = {
    tower_base: { width: 48, height: 48 },
    archer_turret: { width: 48, height: 48 },
    archer_projectile: { width: 48, height: 48 },
    cannon_turret: { width: 48, height: 48 },
    cannon_projectile: { width: 48, height: 48 },
    ice_turret: { width: 48, height: 48 },
    ice_projectile: { width: 48, height: 48 },
    castle: { width: 64, height: 64 },

    // Control button images (these might need different handling if they are fixed size in HTML)
    control_archer: { width: 24, height: 24 },
    control_cannon: { width: 24, height: 24 },
    control_ice: { width: 24, height: 24 },
};

/** DATA **/
const towerStats = {
    archer: { cost: 50, range: 120, damage: 15, rate: 30, projectileSpeed: 12, icon: '🏹', type: 'single', turretImg: 'archer_turret', projectileImg: 'archer_projectile' },
    cannon: { cost: 120, range: 150, damage: 50, rate: 80, projectileSpeed: 10, icon: '💣', type: 'area', turretImg: 'cannon_turret', projectileImg: 'cannon_projectile' },
    ice:    { cost: 200, range: 100, damage: 5, rate: 10, projectileSpeed: 8, icon: '❄️', type: 'slow', turretImg: 'ice_turret', projectileImg: 'ice_projectile' }
};

const enemyTypes = {
    orc:   { hp: 30, speed: 1.5, reward: 10, icon: '👾' },
    bat:   { hp: 15, speed: 3.5, reward: 15, icon: '🦇' },
    golem: { hp: 150, speed: 0.8, reward: 50, icon: '👹' }
};

/** STATE **/
let levelNum = 1;
let gold = 150;
let lives = 10; // Fixed to 10
const MAX_WAVES = 20; // Fixed to 20 waves per level
let wave = 1;
let enemies = [];
let towers = [];
let projectiles = [];
let particles = [];
let path = [];
let mapColors = {}; 

let isGameOver = false;
let isPaused = false;
let waveActive = false;
let spawnQueue = [];
let spawnTimer = 0;

/** MAP GENERATOR **/
function generateMap() {
    const hues = [120, 30, 200, 40];
    const baseHue = hues[Math.floor(Math.random() * hues.length)];
    mapColors = { bg: `hsl(${baseHue}, 40%, 40%)`, road: `hsl(${baseHue}, 20%, 70%)` };

    const cols = 8;
    const rows = 6;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    // Define the exclusion zone for the top UI
    const UI_EXCLUSION_HEIGHT = 80;
    const firstUsableRowIndex = Math.ceil(UI_EXCLUSION_HEIGHT / cellH);
    const numUsableRows = rows - firstUsableRowIndex;

    // If there aren't enough usable rows, you might need to adjust canvas size or UI height
    if (numUsableRows <= 0) {
        console.error("Not enough space for path below UI! Adjust canvas height or UI_EXCLUSION_HEIGHT.");
        // Fallback or throw an error to prevent infinite loop
        // For now, let's just make sure it uses at least row 0 if no other option
        // This makes the path *potentially* go under UI, but avoids breaking the game
        const fallbackRowStart = Math.max(0, firstUsableRowIndex);
        // Ensure there's at least one row if somehow it gets negative
        const fallbackNumRows = Math.max(1, rows - fallbackRowStart);
        
        let checkpoints = [];
        let currentRow = fallbackRowStart + Math.floor(Math.random() * fallbackNumRows);
        checkpoints.push({ c: 0, r: currentRow }); // Start path
        // ... rest of path generation as before, but using fallbackRowStart/fallbackNumRows for subsequent rows
        // This specific error handling is robust, but for a quick fix, just ensuring firstUsableRowIndex is reasonable
        // and using a Math.max(0, ...) is sufficient for random row generation.
    }


    let checkpoints = [];
    // Ensure the starting row is below the UI exclusion zone
    let currentRow = firstUsableRowIndex + Math.floor(Math.random() * numUsableRows);
    checkpoints.push({ c: 0, r: currentRow });

    for (let c = 2; c < cols - 1; c += 2) {
        // Ensure new rows are also below the UI exclusion zone
        let newRow = firstUsableRowIndex + Math.floor(Math.random() * numUsableRows);
        checkpoints.push({ c: c, r: newRow });
    }
    
    // Final point must be before the last column to make space for the castle,
    // and also below the UI exclusion zone.
    checkpoints.push({ c: cols - 1, r: firstUsableRowIndex + Math.floor(Math.random() * numUsableRows) }); 

    path = [];
    let currentX = 0;
    let currentY = checkpoints[0].r * cellH + (cellH/2);
    path.push({x: currentX, y: currentY});

    for (let i = 1; i < checkpoints.length; i++) {
        let targetX = checkpoints[i].c * cellW + (cellW/2);
        let targetY = checkpoints[i].r * cellH + (cellH/2);

        path.push({x: targetX, y: currentY});
        path.push({x: targetX, y: targetY});
        
        currentX = targetX;
        currentY = targetY;
    }
}

/** CORE **/
function initLevel() {
    generateMap();
    gold += 50;
    wave = 1;
    lives = 10; 
    enemies = [];
    towers = [];
    projectiles = [];
    particles = [];
    isGameOver = false;
    spawnQueue = [];
    document.getElementById('modal').style.display = 'none';
    updateUI();
    setTimeout(startWave, 1000);
}

// Fisher-Yates shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function startWave() {
    waveActive = true;
    spawnQueue = [];

    const baseOrcs = 5 + Math.floor(wave * 0.5);
    const baseBats = Math.floor(wave * 0.4);
    const baseGolems = Math.floor(wave * 0.2);

    for(let i=0; i < baseOrcs; i++) spawnQueue.push('orc');
    for(let i=0; i < baseBats; i++) spawnQueue.push('bat');
    for(let i=0; i < baseGolems; i++) spawnQueue.push('golem');

    shuffleArray(spawnQueue);
}

// Global functions for UI interaction
window.togglePause = function() {
    isPaused = !isPaused;
    const btn = document.getElementById('btn-pause');
    btn.innerText = isPaused ? "▶️ Resume" : "⏸️ Pause";
    btn.style.background = isPaused ? "#4caf50" : "#ff9800";
}

function update() {
    if(isPaused) {
        draw();
        requestAnimationFrame(update);
        return;
    }
    
    if(isGameOver) return;

    // Spawning
    if(spawnQueue.length > 0) {
        spawnTimer++;
        if(spawnTimer > 40) {
            spawnEnemy(spawnQueue.shift());
            spawnTimer = 0;
        }
    } else if (enemies.length === 0 && waveActive) {
        waveActive = false;
        if(wave < MAX_WAVES) {
            wave++;
            setTimeout(startWave, 2000);
        } else {
            levelComplete();
        }
        updateUI();
    }

    // Logic
    enemies.forEach(moveEnemy);
    towers.forEach(runTower);
    projectiles.forEach(moveProjectile);
    updateParticles();

    // Cleanup
    enemies = enemies.filter(e => e.hp > 0 && !e.reached);
    projectiles = projectiles.filter(p => !p.hit);

    draw();
    requestAnimationFrame(update);
}

function spawnEnemy(type) {
    let stats = enemyTypes[type];
    let multi = 1 + (levelNum * 0.2) + (wave * 0.15);
    
    enemies.push({
        x: path[0].x, y: path[0].y,
        wp: 0,
        type: type,
        hp: stats.hp * multi,
        maxHp: stats.hp * multi,
        speed: stats.speed,
        reward: stats.reward,
        frozen: 0,
        reached: false
    });
}

function moveEnemy(e) {
    let speed = e.frozen > 0 ? e.speed * 0.5 : e.speed;
    if(e.frozen > 0) e.frozen--;

    let target = path[e.wp + 1];
    if(!target) return;

    let dx = target.x - e.x;
    let dy = target.y - e.y;
    let dist = Math.hypot(dx, dy);

    if(dist < speed) {
        e.x = target.x; e.y = target.y;
        e.wp++;
        if(e.wp >= path.length - 1) {
            e.reached = true;
            lives--;
            updateUI();
            if(lives <= 0) triggerGameOver();
        }
    } else {
        e.x += (dx/dist) * speed;
        e.y += (dy/dist) * speed;
    }
}

function runTower(t) {
    if(t.cd > 0) t.cd--;
    else {
        // Find target
        const target = enemies.find(e => Math.hypot(e.x - t.x, e.y - t.y) <= t.stats.range);
        if(target) {
            // Calculate angle to target for turret rotation
            t.angle = Math.atan2(target.y - t.y, target.x - t.x);
            
            projectiles.push({
                x: t.x, y: t.y,
                target: target,
                stats: t.stats,
                hit: false,
                angle: t.angle // Projectile can inherit angle for initial direction
            });
            t.cd = t.stats.rate;
            t.shooting = 5; // Brief shooting animation frame
        }
    }
    if(t.shooting > 0) t.shooting--;
}

function moveProjectile(p) {
    if(p.target.hp <= 0 && !p.target.reached) { p.hit = true; return; }
    let dx = p.target.x - p.x, dy = p.target.y - p.y;
    let dist = Math.hypot(dx, dy);
    
    if(dist < p.stats.projectileSpeed) { // Hit radius
        p.hit = true;
        p.target.hp -= p.stats.damage;
        if(p.stats.type === 'slow') p.target.frozen = 40;
        
        if(p.stats.type === 'area') {
            enemies.forEach(e => {
                if(Math.hypot(e.x - p.target.x, e.y - p.target.y) < 60) {
                    e.hp -= p.stats.damage/2;
                }
            });
            createExplosion(p.x, p.y, 'orange', 10);
        } else {
            createExplosion(p.x, p.y, 'white', 5);
        }

        if(p.target.hp <= 0) {
            gold += p.target.reward;
            updateUI();
        }
    } else {
        p.x += (dx/dist) * p.stats.projectileSpeed;
        p.y += (dy/dist) * p.stats.projectileSpeed;
    }
}

function createExplosion(x, y, color, count = 5) {
    for(let i=0; i<count; i++) {
        particles.push({x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:15, color});
    }
}

function updateParticles() {
    particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
    particles = particles.filter(p => p.life > 0);
}

/** DRAW **/
function draw() {
    ctx.fillStyle = mapColors.bg;
    ctx.fillRect(0,0,canvas.width, canvas.height);

    // Path
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.lineWidth = 40;
    ctx.strokeStyle = mapColors.road;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Castle
    const endP = path[path.length-1];
    const castleImg = window.Images['castle'];
    const castleSize = IMAGE_DISPLAY_SIZES['castle']; // <--- GET SIZE
    if (castleImg && castleImg.complete && castleSize) {
        ctx.drawImage(
            castleImg,
            endP.x - castleSize.width / 2, // Center the image
            endP.y - castleSize.height / 2 - 10, // Adjust Y for perspective/base
            castleSize.width,
            castleSize.height
        );
    } else { // Fallback if image not loaded or not complete
        ctx.font = "50px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏰", endP.x, endP.y - 15);
    }
    
    // Towers
    towers.forEach(t => {
        const baseImg = window.Images['tower_base'];
        const turretImg = window.Images[t.stats.turretImg]; // e.g., 'archer_turret'

        const baseDisplaySize = IMAGE_DISPLAY_SIZES['tower_base']; // <--- GET BASE SIZE
        const turretDisplaySize = IMAGE_DISPLAY_SIZES[t.stats.turretImg]; // <--- GET TURRET SIZE

        // Base
        if (baseImg && baseImg.complete && baseDisplaySize) {
            ctx.drawImage(
                baseImg,
                t.x - baseDisplaySize.width / 2,
                t.y - baseDisplaySize.height / 2,
                baseDisplaySize.width,
                baseDisplaySize.height
            );
        } else { // Fallback
            ctx.fillStyle = '#222';
            ctx.fillRect(t.x-15, t.y-15, 30, 30);
        }

        // Turret (dynamically scale based on shooting state)
        if (turretImg && turretImg.complete && turretDisplaySize) {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.rotate(t.angle || 0);

            // Apply a slight scale increase if shooting, but relative to its defined size
            const currentTurretWidth = t.shooting > 0 ? turretDisplaySize.width * 1.1 : turretDisplaySize.width;
            const currentTurretHeight = t.shooting > 0 ? turretDisplaySize.height * 1.1 : turretDisplaySize.height;

            ctx.drawImage(
                turretImg,
                -currentTurretWidth / 2,
                -currentTurretHeight / 2,
                currentTurretWidth,
                currentTurretHeight
            );
            ctx.restore();
        } else { // Fallback
            ctx.fillStyle = t.stats.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Cooldown Indicator (no change here)
        if(t.cd > 0) {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(t.x-15, t.y-20, 30 * (t.cd / t.stats.rate), 2);
        }
    });

    // Enemies
    enemies.forEach(e => {
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(enemyTypes[e.type].icon, e.x, e.y); // Center emoji
        
        ctx.fillStyle = 'red'; ctx.fillRect(e.x-15, e.y-20, 30, 3);
        ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-15, e.y-20, 30 * (e.hp/e.maxHp), 3);
    });

    // Projectiles
    projectiles.forEach(p => {
        const projImg = window.Images[p.stats.projectileImg];
        const projDisplaySize = IMAGE_DISPLAY_SIZES[p.stats.projectileImg]; // <--- GET PROJECTILE SIZE
        if (projImg && projImg.complete && projDisplaySize) {
             ctx.save();
             ctx.translate(p.x, p.y);
             ctx.rotate(p.angle || 0);
             ctx.drawImage(
                projImg,
                -projDisplaySize.width / 2,
                -projDisplaySize.height / 2,
                projDisplaySize.width,
                projDisplaySize.height
            );
             ctx.restore();
        } else { // Fallback
            ctx.fillStyle = p.stats.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
        }
    });

    // Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    
    if(isPaused) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.fillText("PAUSED", canvas.width/2, canvas.height/2);

        ctx.font = "20px Arial"; 
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "lightgray";

        ctx.fillText("Made by Gemini and Joe !!!", canvas.width/2, canvas.height/2 + 40);
    }
}

/** CONTROLS **/
let selectedType = 'archer';
window.selectTower = function(t) { // Make global
    selectedType = t;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('btn-'+t).classList.add('selected');
}

function distToSegmentSq(p, v, w) {
    let l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
    if (l2 == 0) return (p.x - v.x)**2 + (p.y - v.y)**2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return (p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2;
}

canvas.addEventListener('click', e => {
    if(isGameOver || isPaused) return;
    let rect = canvas.getBoundingClientRect();
    let mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let s = towerStats[selectedType];

    if(gold < s.cost) return;

    // Check collision (Towers + Castle Area + Road)
    const endP = path[path.length-1];
    // We assume castle is 40x40 for collision, but image is 32x32 for drawing (adjust if images change)
    if(Math.hypot(endP.x - mx, endP.y - my) < 50) return; // Don't build near castle

    for(let t of towers) if(Math.hypot(t.x-mx, t.y-my) < 30) return; // Tower-tower collision
    for(let i=0; i<path.length-1; i++) {
        if(distToSegmentSq({x:mx, y:my}, path[i], path[i+1]) < 900) return; // Road collision (30px radius)
    }

    towers.push({x:mx, y:my, stats:s, cd:0, angle:0, shooting:0}); // Add angle and shooting state
    gold -= s.cost;
    updateUI();
});

window.levelComplete = function() { // Make global
    isGameOver = true;
    document.getElementById('modal-title').innerText = `Level ${levelNum} Complete!`;
    document.getElementById('modal-btn').innerText = "Enter Next Realm";
    document.getElementById('modal').style.display = 'flex';
}

function triggerGameOver() {
    isGameOver = true;
    document.getElementById('modal-title').innerText = "Game Over";
    document.getElementById('modal-title').style.color = "red";
    document.getElementById('modal-btn').innerText = "Try Again";
    document.getElementById('modal-btn').onclick = () => location.reload();
    document.getElementById('modal').style.display = 'flex';
}

window.nextLevel = function() { // Make global
    levelNum++;
    initLevel();
    requestAnimationFrame(update);
}

function updateUI() {
    document.getElementById('gold').innerText = Math.floor(gold);
    document.getElementById('lives').innerText = lives;
    document.getElementById('wave').innerText = `${wave}/${MAX_WAVES}`;
    document.getElementById('level').innerText = levelNum;
}

// Initial call to load images and then start the game
Promise.all(window.imagePromises).then(() => {
    // Once all images are loaded, set their src for the control buttons
    document.getElementById('img-archer-control').src = window.Images['control_archer'].src;
    document.getElementById('img-cannon-control').src = window.Images['control_cannon'].src;
    document.getElementById('img-ice-control').src = window.Images['control_ice'].src;

    initLevel();
    requestAnimationFrame(update);
}).catch(error => {
    console.error("Failed to load images:", error);
    alert("Error loading game images. Please refresh. Check console for details.");
});