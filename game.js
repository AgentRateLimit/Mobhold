// Game constants
const TILE_SIZE = 16;
const PLAYER_TILE_SIZE = 48;
const PLAYER_SCALED_SIZE = 128;  // Display player at 96x96
const BASE_SCALE = 3;
let scale = BASE_SCALE;
let SCALED_TILE = TILE_SIZE * scale;
const PLAYER_SPEED = 150;
const SPEED_BOOST_MULTIPLIER = 1.25;
const SPEED_BOOST_DURATION = 1.5; // seconds
const POST_UPGRADE_INVINCIBILITY = 1.5; // seconds of invincibility after upgrade
const POST_UPGRADE_DELAY = 1.0; // seconds of pause after selecting upgrade

// Patreon funding goal
const PATREON_GOAL = 500; // $500/month goal
let patreonCurrent = 0; // Current monthly amount (fetched or updated manually)

function calculateScale() {
    const minDimension = Math.min(window.innerWidth, window.innerHeight);
    // Reduce scale on small screens (< 600px)
    if (minDimension < 600) {
        scale = 2;
    } else if (minDimension < 800) {
        scale = 2.5;
    } else {
        scale = BASE_SCALE;
    }
    SCALED_TILE = TILE_SIZE * scale;
}

// Tile types for the map
// overlay: true means draw on top of standard grass tile
const TILE_TYPES = {
    GRASS: { col: 4, row: 3, blocking: false },
    GRASS_DECORATED: { col: 0, row: 3, blocking: false },
    // Vertical mountain (column 0, rows 4-6)
    MOUNTAIN_TOP: { col: 0, row: 4, blocking: true, overlay: true },
    MOUNTAIN_MID: { col: 0, row: 5, blocking: true, overlay: true },
    MOUNTAIN_BASE: { col: 0, row: 6, blocking: true, overlay: true },
    // Horizontal mountain (column 7, rows 1-3)
    MOUNTAIN_H_LEFT: { col: 1, row: 7, blocking: true, overlay: true },
    MOUNTAIN_H_MID: { col: 2, row: 7, blocking: true, overlay: true },
    MOUNTAIN_H_RIGHT: { col: 3, row: 7, blocking: true, overlay: true },
    PLANT: { blocking: false, isPlant: true }
};

const tileMap = new Map(); // Sparse storage: "x,y" -> tile type
const ENEMY_BASE_SPEED = 60;
const PROJECTILE_SPEED = 300;
const MIN_SPAWN_INTERVAL = 500;
const DEFAULT_SPAWN_INTERVAL = 2500;

// Swarm event constants
const SWARM_FIRST_DELAY = 45000; // First swarm after 45 seconds
const SWARM_INTERVAL = 35000; // Then every 35 seconds
const SWARM_MIN_COUNT = 5;
const SWARM_MAX_COUNT = 12;
const SWARM_SPAWN_RADIUS_MIN = 400;
const SWARM_SPAWN_RADIUS_MAX = 550;
const CENTER_DEAD_ZONE = 50;

// Bomb constants
const BOMB_TRAVEL_DISTANCE = 100;
const BOMB_FUSE_TIME = 1000;
const BOMB_EXPLODE_RADIUS = SCALED_TILE * 2;
const EXPLOSION_FRAME_DURATION = 50; // ms per frame
const EXPLOSION_TOTAL_FRAMES = 16; // 4x4 sprite sheet
const BLOOD_FRAME_DURATION = 40; // ms per frame
const BLOOD_TOTAL_FRAMES = 16; // 4x4 sprite sheet

// Circlet constants
const Circlet_ORBIT_RADIUS = 160;
const Circlet_ORBIT_SPEED = 2; // radians per second
const Circlet_HIT_COOLDOWN = 500; // ms between hits on same enemy

// Shuriken constants
const SHURIKEN_SPIN_SPEED = 12; // radians per second

// Upgrade thresholds (earlier upgrades, then scales up)
const UPGRADE_THRESHOLDS = [16, 50, 100, 180, 300, 480, 720, 1000, 1400, 1900, 2500, 3300, 4300, 5500, 7000, 9000, 12000, 15000];

// Scroll config
const SCROLL_TYPES = ['ScrollFire', 'ScrollIce', 'ScrollThunder'];
const SCROLL_CONFIG = {
    ScrollThunder: { minInterval: 4000, maxInterval: 8000, damage: 25, effectFrames: 8, frameWidth: 64, desc: ['25 instant dmg', 'nearest enemy'] },
    ScrollFire: { minInterval: 5000, maxInterval: 10000, burnDamage: 3, burnDuration: 3000, tickInterval: 500, effectFrames: 10, frameWidth: 48, desc: ['18 burn dmg/3s', 'nearest enemy'] },
    ScrollIce: { minInterval: 6000, maxInterval: 12000, freezeDuration: 2000, effectFrames: 10, frameWidth: 48, desc: ['Freeze 2s', 'nearest enemy'] }
};

// Monster type to folder and sprite file mapping
const MONSTER_SPRITE_MAP = {
    'SpiderYellow': { folder: 'SpiderYellow', file: 'SpriteSheet.png' },
    'YellowBat': { folder: 'YellowsBat', file: 'SpriteSheet.png' },
    'Eye': { folder: 'Eye', file: 'Eye.png' },
    'Eye2': { folder: 'Eye2', file: 'Eye2.png' },
    'Beast': { folder: 'Beast', file: 'Beast.png' },
    'Beast2': { folder: 'Beast2', file: 'Beast2.png' },
    'Reptile': { folder: 'Reptile', file: 'Reptile.png' },
    'Cyclopse': { folder: 'Cyclope', file: 'SpriteSheet.png' },
    'Cyclopse2': { folder: 'Cyclope2', file: 'SpriteSheet.png' }
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.imageSmoothingEnabled = false;
    calculateScale();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game data (loaded from JSON)
let weaponsData = [];
let monstersData = [];
let spawnPhasesData = [];

// Game state
let gameState = 'loading'; // 'loading', 'playing', 'upgrading', 'gameover', 'paused'
let readyTimer = 0; // Countdown overlay after upgrade/unpause
let score = 0;
let highScore = 0;
let lastTime = 0;
let spawnTimer = 0;
let gameTime = 0; // Track total game time for spawn acceleration
let currentSpawnInterval = DEFAULT_SPAWN_INTERVAL;
let nextUpgradeIndex = 0;
let swarmTimer = 0; // Track time until next swarm event
let firstSwarmDone = false; // Track if first swarm has occurred
let speedBoostTimer = 0; // Time remaining on speed boost after upgrade
let invincibilityTimer = 0; // Time remaining where enemies can't kill player

// Player weapons
let playerWeapons = []; // Array of { type: string, level: number, cooldownTimer: number }

// Player facing angle (for Arrow direction)
let playerFacingAngle = 0;

// Camera/World offset
let cameraX = 0;
let cameraY = 0;

// Player
const player = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    frame: 0,
    frameTime: 0,
    facingRight: true,
    moving: false,
    direction: 'front'  // 'front', 'side', 'back'
};

// Arrays for game objects
let enemies = [];
let projectiles = [];
let orbitingProjectiles = [];
let explosions = [];
let bloodSplatters = [];

// Upgrade UI state
let upgradeOptions = [];

// Scroll state
let playerScrolls = [];   // { type, nextTriggerTime }
let scrollEffects = [];   // Active visual effects

// Mobile joystick state
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

// Desktop mouse state for continuous movement
let mouseHeld = false;
let mouseScreenX = 0;
let mouseScreenY = 0;
const JOYSTICK_BASE_RADIUS = 60;
const JOYSTICK_KNOB_RADIUS = 30;
const JOYSTICK_DEAD_ZONE = 10;
let joystick = {
    active: false,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
    touchId: null,
    dirX: 0,
    dirY: 0
};

// Gamepad state
let gamepad = {
    connected: false,
    index: null,
    deadZone: 0.15,
    leftStick: { x: 0, y: 0 },
    buttons: { start: false, prevStart: false }
};

// Keyboard state
let keyboard = {
    up: false,
    down: false,
    left: false,
    right: false
};

// Images
const images = {};

// Load JSON data
async function loadGameData() {
    try {
        const [weaponsResponse, monstersResponse, spawnPhasesResponse] = await Promise.all([
            fetch('weapons.json'),
            fetch('monsters.json'),
            fetch('spawn-phases.json')
        ]);
        weaponsData = await weaponsResponse.json();
        monstersData = await monstersResponse.json();
        spawnPhasesData = await spawnPhasesResponse.json();
    } catch (error) {
        console.error('Failed to load game data:', error);
    }

    // Load Patreon progress (optional, fails silently)
    try {
        const patreonResponse = await fetch('patreon.json');
        const patreonData = await patreonResponse.json();
        patreonCurrent = patreonData.current || 0;
    } catch (error) {
        // Patreon data is optional, default to 0
    }

    // Load high score from localStorage
    try {
        const savedHighScore = localStorage.getItem('survivalHighScore');
        if (savedHighScore !== null) {
            highScore = parseInt(savedHighScore, 10) || 0;
        }
    } catch (error) {
        // localStorage not available, high score won't persist
    }
}

// Load all images
function loadImages(callback) {
    const imagesToLoad = [
        { name: 'ground', src: 'images/plains.png' },
        { name: 'player', src: 'images/player.png' },
        // Projectiles
        { name: 'Arrow', src: 'images/Items/Projectile/Arrow.png' },
        { name: 'Shuriken', src: 'images/Items/Projectile/Shuriken.png' },
        { name: 'Kunai', src: 'images/Items/Projectile/Kunai.png' },
        { name: 'Bomb', src: 'images/Items/Projectile/Bomb.png' },
        { name: 'Circlet', src: 'images/Items/Projectile/Circlet.png' },
        { name: 'Explosion', src: 'images/Items/Projectile/Explosion.png' },
        { name: 'Blood', src: 'images/Items/Projectile/Blood.png' },
        // Scroll icons
        { name: 'ScrollThunder', src: 'images/Items/Scroll/ScrollThunder.png' },
        { name: 'ScrollFire', src: 'images/Items/Scroll/ScrollFire.png' },
        { name: 'ScrollIce', src: 'images/Items/Scroll/ScrollIce.png' },
        // Scroll effect spritesheets
        { name: 'EffectThunder', src: 'images/Items/Effect/Thunder/SpriteSheet.png' },
        { name: 'EffectFire', src: 'images/Items/Effect/Flam/SpriteSheet.png' },
        { name: 'EffectIce', src: 'images/Items/Effect/Ice/SpriteSheet.png' },
        { name: 'plant', src: 'images/Items/Plant/SpriteSheet16x16.png' }
    ];

    // Add monster images based on monsters.json
    for (const monster of monstersData) {
        const spriteInfo = MONSTER_SPRITE_MAP[monster.type];
        if (spriteInfo) {
            imagesToLoad.push({
                name: `monster_${monster.type}`,
                src: `images/Monsters/${spriteInfo.folder}/${spriteInfo.file}`
            });
        }
    }

    let loaded = 0;
    const total = imagesToLoad.length;

    for (const img of imagesToLoad) {
        images[img.name] = new Image();
        images[img.name].onload = () => {
            loaded++;
            if (loaded === total) {
                callback();
            }
        };
        images[img.name].onerror = () => {
            console.error(`Failed to load image: ${img.src}`);
            loaded++;
            if (loaded === total) {
                callback();
            }
        };
        images[img.name].src = img.src;
    }
}

// Input handling
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseleave', handleMouseUp);

// Helper to check if point is inside a button
function isPointInButton(x, y, btn) {
    return x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height;
}

// Cursor hover effect and mouse tracking
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let isOverButton = false;

    // Track mouse position for continuous movement
    mouseScreenX = x;
    mouseScreenY = y;

    if (gameState === 'playing') {
        const pauseBtn = getPauseButtonBounds();
        if (isPointInButton(x, y, pauseBtn)) isOverButton = true;
    } else if (gameState === 'paused') {
        const buttons = getPauseMenuButtonBounds();
        if (isPointInButton(x, y, buttons.resume) ||
            isPointInButton(x, y, buttons.fund) ||
            isPointInButton(x, y, buttons.github) ||
            isPointInButton(x, y, buttons.moreGames)) {
            isOverButton = true;
        }
    } else if (gameState === 'gameover') {
        const buttons = getGameOverButtonBounds();
        if (isPointInButton(x, y, buttons.restart) ||
            isPointInButton(x, y, buttons.fund) ||
            isPointInButton(x, y, buttons.github)) {
            isOverButton = true;
        }
    } else if (gameState === 'upgrading') {
        const buttonWidth = 280;
        const buttonHeight = 80;
        const buttonSpacing = 15;
        const totalHeight = upgradeOptions.length * (buttonHeight + buttonSpacing) - buttonSpacing;
        const startY = (canvas.height - totalHeight) / 2 + 20;
        for (let i = 0; i < upgradeOptions.length; i++) {
            const buttonX = (canvas.width - buttonWidth) / 2;
            const buttonY = startY + i * (buttonHeight + buttonSpacing);
            if (x >= buttonX && x <= buttonX + buttonWidth &&
                y >= buttonY && y <= buttonY + buttonHeight) {
                isOverButton = true;
                break;
            }
        }
    }

    canvas.style.cursor = (isOverButton || mouseHeld)
        ? "url('images/StoneCursorWenrexa/PNG/15.png'), pointer"
        : "url('images/StoneCursorWenrexa/PNG/11.png'), auto";
});

// Desktop mouse input
function handleMouseDown(e) {
    if (isMobile) return;
    const rect = canvas.getBoundingClientRect();
    mouseScreenX = e.clientX - rect.left;
    mouseScreenY = e.clientY - rect.top;
    mouseHeld = true;
    canvas.style.cursor = "url('images/StoneCursorWenrexa/PNG/15.png'), auto";
    handleInputAt(mouseScreenX, mouseScreenY);
}

function handleMouseUp() {
    if (isMobile) return;
    mouseHeld = false;
    canvas.style.cursor = "url('images/StoneCursorWenrexa/PNG/11.png'), auto";
    // Don't stop player.moving - let them continue to final destination
}

// Mobile joystick touch handling
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();

    for (const touch of e.changedTouches) {
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        // Check if this is a UI interaction (game over, upgrade menu, paused)
        if (gameState === 'gameover' || gameState === 'upgrading' || gameState === 'paused') {
            handleInputAt(touchX, touchY);
            return;
        }

        // Start joystick on right side of screen during gameplay
        if (gameState === 'playing') {
            // Check pause button first
            const pauseBtn = getPauseButtonBounds();
            if (touchX >= pauseBtn.x && touchX <= pauseBtn.x + pauseBtn.width &&
                touchY >= pauseBtn.y && touchY <= pauseBtn.y + pauseBtn.height) {
                gameState = 'paused';
                return;
            }

            joystick.active = true;
            joystick.touchId = touch.identifier;
            joystick.baseX = touchX;
            joystick.baseY = touchY;
            joystick.knobX = touchX;
            joystick.knobY = touchY;
            joystick.dirX = 0;
            joystick.dirY = 0;
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystick.active) return;

    const rect = canvas.getBoundingClientRect();

    for (const touch of e.changedTouches) {
        if (touch.identifier === joystick.touchId) {
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            // Calculate distance from joystick base
            const dx = touchX - joystick.baseX;
            const dy = touchY - joystick.baseY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Clamp knob position to joystick radius
            if (dist > JOYSTICK_BASE_RADIUS) {
                joystick.knobX = joystick.baseX + (dx / dist) * JOYSTICK_BASE_RADIUS;
                joystick.knobY = joystick.baseY + (dy / dist) * JOYSTICK_BASE_RADIUS;
            } else {
                joystick.knobX = touchX;
                joystick.knobY = touchY;
            }

            // Calculate normalized direction (with dead zone)
            if (dist > JOYSTICK_DEAD_ZONE) {
                const normalizedDist = Math.min(dist, JOYSTICK_BASE_RADIUS) / JOYSTICK_BASE_RADIUS;
                joystick.dirX = (dx / dist) * normalizedDist;
                joystick.dirY = (dy / dist) * normalizedDist;

                // Update player facing angle for Arrow weapon
                playerFacingAngle = Math.atan2(dy, dx);
            } else {
                joystick.dirX = 0;
                joystick.dirY = 0;
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    for (const touch of e.changedTouches) {
        if (touch.identifier === joystick.touchId) {
            joystick.active = false;
            joystick.touchId = null;
            joystick.dirX = 0;
            joystick.dirY = 0;
        }
    }
});

canvas.addEventListener('touchcancel', (e) => {
    for (const touch of e.changedTouches) {
        if (touch.identifier === joystick.touchId) {
            joystick.active = false;
            joystick.touchId = null;
            joystick.dirX = 0;
            joystick.dirY = 0;
        }
    }
});

// Gamepad connection handlers
window.addEventListener('gamepadconnected', (e) => {
    gamepad.connected = true;
    gamepad.index = e.gamepad.index;
});

window.addEventListener('gamepaddisconnected', (e) => {
    if (gamepad.index === e.gamepad.index) {
        gamepad.connected = false;
        gamepad.index = null;
        gamepad.leftStick = { x: 0, y: 0 };
        gamepad.buttons = { start: false, prevStart: false };
    }
});

// Keyboard event handlers
window.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'ArrowUp':
        case 'KeyW':
            keyboard.up = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keyboard.down = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keyboard.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keyboard.right = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'ArrowUp':
        case 'KeyW':
            keyboard.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keyboard.down = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keyboard.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keyboard.right = false;
            break;
    }
});

function handleInputAt(screenX, screenY) {
    if (gameState === 'gameover') {
        const buttons = getGameOverButtonBounds();

        // Check restart button
        if (screenX >= buttons.restart.x && screenX <= buttons.restart.x + buttons.restart.width &&
            screenY >= buttons.restart.y && screenY <= buttons.restart.y + buttons.restart.height) {
            restartGame();
            return;
        }

        // Check fund button
        if (screenX >= buttons.fund.x && screenX <= buttons.fund.x + buttons.fund.width &&
            screenY >= buttons.fund.y && screenY <= buttons.fund.y + buttons.fund.height) {
            window.open('https://www.patreon.com/15462430/join', '_blank');
            return;
        }

        // Check github button
        if (screenX >= buttons.github.x && screenX <= buttons.github.x + buttons.github.width &&
            screenY >= buttons.github.y && screenY <= buttons.github.y + buttons.github.height) {
            window.open('https://github.com/AgentRateLimit/Mobhold', '_blank');
            return;
        }

        return;
    }

    if (gameState === 'paused') {
        const buttons = getPauseMenuButtonBounds();

        // Check resume button
        if (screenX >= buttons.resume.x && screenX <= buttons.resume.x + buttons.resume.width &&
            screenY >= buttons.resume.y && screenY <= buttons.resume.y + buttons.resume.height) {
            readyTimer = POST_UPGRADE_DELAY;
            gameState = 'playing';
            return;
        }

        // Check fund button
        if (screenX >= buttons.fund.x && screenX <= buttons.fund.x + buttons.fund.width &&
            screenY >= buttons.fund.y && screenY <= buttons.fund.y + buttons.fund.height) {
            window.open('https://www.patreon.com/15462430/join', '_blank');
            return;
        }

        // Check github button
        if (screenX >= buttons.github.x && screenX <= buttons.github.x + buttons.github.width &&
            screenY >= buttons.github.y && screenY <= buttons.github.y + buttons.github.height) {
            window.open('https://github.com/AgentRateLimit/Mobhold', '_blank');
            return;
        }

        // Check more games button
        if (screenX >= buttons.moreGames.x && screenX <= buttons.moreGames.x + buttons.moreGames.width &&
            screenY >= buttons.moreGames.y && screenY <= buttons.moreGames.y + buttons.moreGames.height) {
            window.open('https://agentratelimit.github.io/website/', '_blank');
            return;
        }

        return;
    }

    if (gameState === 'upgrading') {
        handleUpgradeClick(screenX, screenY);
        return;
    }

    if (gameState !== 'playing') return;

    // Check pause button click (not during ready countdown)
    const pauseBtn = getPauseButtonBounds();
    if (readyTimer <= 0 && screenX >= pauseBtn.x && screenX <= pauseBtn.x + pauseBtn.width &&
        screenY >= pauseBtn.y && screenY <= pauseBtn.y + pauseBtn.height) {
        gameState = 'paused';
        return;
    }

    // Convert screen position to world position
    const worldX = screenX + cameraX - canvas.width / 2;
    const worldY = screenY + cameraY - canvas.height / 2;

    player.targetX = worldX;
    player.targetY = worldY;
    player.moving = true;

    // Update player facing angle for Arrow weapon
    playerFacingAngle = Math.atan2(worldY - player.y, worldX - player.x);
}

function handleUpgradeClick(screenX, screenY) {
    const buttonWidth = 280;
    const buttonHeight = 80;
    const buttonSpacing = 15;
    const totalHeight = upgradeOptions.length * (buttonHeight + buttonSpacing) - buttonSpacing;
    const startY = (canvas.height - totalHeight) / 2 + 20;

    for (let i = 0; i < upgradeOptions.length; i++) {
        const buttonX = (canvas.width - buttonWidth) / 2;
        const buttonY = startY + i * (buttonHeight + buttonSpacing);

        if (screenX >= buttonX && screenX <= buttonX + buttonWidth &&
            screenY >= buttonY && screenY <= buttonY + buttonHeight) {
            applyUpgrade(upgradeOptions[i]);
            readyTimer = POST_UPGRADE_DELAY;
            gameState = 'playing';
            return;
        }
    }
}

function applyUpgrade(option) {
    if (option.isScroll) {
        // Add scroll with random initial trigger time
        const config = SCROLL_CONFIG[option.type];
        const initialDelay = config.minInterval + Math.random() * (config.maxInterval - config.minInterval);
        playerScrolls.push({
            type: option.type,
            nextTriggerTime: gameTime + initialDelay
        });
    } else if (option.isNew) {
        // Add new weapon at level 0
        playerWeapons.push({
            type: option.type,
            level: 0,
            cooldownTimer: 0
        });
    } else {
        // Upgrade existing weapon
        const weapon = playerWeapons.find(w => w.type === option.type);
        if (weapon) {
            weapon.level++;
        }
    }

    // Update circlets if Circlet weapon was added or upgraded
    if (option.type === 'Circlet') {
        updateCirclets();
    }

    // Grant speed boost to escape dangerous situations
    speedBoostTimer = SPEED_BOOST_DURATION;

    // Grant invincibility to survive being surrounded
    invincibilityTimer = POST_UPGRADE_INVINCIBILITY;
}

// Tile helper functions
function seededRandom(x, y) {
    // Simple deterministic hash for consistent world generation
    const seed = x * 374761393 + y * 668265263;
    let n = seed;
    n = (n ^ (n >> 13)) * 1274126177;
    n = n ^ (n >> 16);
    return (n & 0x7fffffff) / 0x7fffffff;
}

function worldToTile(worldX, worldY) {
    return {
        x: Math.floor(worldX / SCALED_TILE),
        y: Math.floor(worldY / SCALED_TILE)
    };
}

function getTileAt(tileX, tileY) {
    const key = `${tileX},${tileY}`;

    // Return cached tile if exists
    if (tileMap.has(key)) {
        return tileMap.get(key);
    }

    // Generate tile procedurally
    const rand = seededRandom(tileX, tileY);
    let tileType = TILE_TYPES.GRASS;

    // Safe zone: no mountains within 3 tiles of origin
    const inSafeZone = Math.abs(tileX) <= 3 && Math.abs(tileY) <= 3;

    if (!inSafeZone && rand < 0.01) {
        // ~1% chance: start a vertical mountain formation (this is the base)
        // Check that we're not already part of another mountain
        const aboveKey1 = `${tileX},${tileY - 1}`;
        const aboveKey2 = `${tileX},${tileY - 2}`;
        if (!tileMap.has(aboveKey1) && !tileMap.has(aboveKey2)) {
            // Create a 3-tile vertical mountain formation
            tileMap.set(`${tileX},${tileY - 2}`, TILE_TYPES.MOUNTAIN_TOP);
            tileMap.set(`${tileX},${tileY - 1}`, TILE_TYPES.MOUNTAIN_MID);
            tileMap.set(key, TILE_TYPES.MOUNTAIN_BASE);
            return TILE_TYPES.MOUNTAIN_BASE;
        }
    } else if (!inSafeZone && rand < 0.02) {
        // ~1% chance: start a horizontal mountain formation (this is the right end)
        // Check that we're not already part of another mountain
        const leftKey1 = `${tileX - 1},${tileY}`;
        const leftKey2 = `${tileX - 2},${tileY}`;
        if (!tileMap.has(leftKey1) && !tileMap.has(leftKey2)) {
            // Create a 3-tile horizontal mountain formation
            tileMap.set(`${tileX - 2},${tileY}`, TILE_TYPES.MOUNTAIN_H_LEFT);
            tileMap.set(`${tileX - 1},${tileY}`, TILE_TYPES.MOUNTAIN_H_MID);
            tileMap.set(key, TILE_TYPES.MOUNTAIN_H_RIGHT);
            return TILE_TYPES.MOUNTAIN_H_RIGHT;
        }
    } else if (rand < 0.04) {
        // ~2% chance: decorated grass
        tileType = TILE_TYPES.GRASS_DECORATED;
    } else if (rand < 0.045) {
        // ~0.5% chance: decorative plant
        tileType = TILE_TYPES.PLANT;
    }

    tileMap.set(key, tileType);
    return tileType;
}

function isPositionBlocked(worldX, worldY) {
    // Check the tile at the center of the entity
    const tile = worldToTile(worldX, worldY);
    const tileType = getTileAt(tile.x, tile.y);
    return tileType.blocking;
}

// Drawing functions
function drawBackground() {
    const startX = Math.floor((cameraX - canvas.width / 2) / SCALED_TILE) * SCALED_TILE;
    const startY = Math.floor((cameraY - canvas.height / 2) / SCALED_TILE) * SCALED_TILE;

    for (let y = startY; y < cameraY + canvas.height / 2 + SCALED_TILE; y += SCALED_TILE) {
        for (let x = startX; x < cameraX + canvas.width / 2 + SCALED_TILE; x += SCALED_TILE) {
            const screenX = Math.round(x - cameraX + canvas.width / 2);
            const screenY = Math.round(y - cameraY + canvas.height / 2);

            // Get tile type for this world position
            const tile = worldToTile(x, y);
            const tileType = getTileAt(tile.x, tile.y);

            // Always draw grass base first
            ctx.drawImage(
                images.ground,
                TILE_TYPES.GRASS.col * TILE_SIZE, TILE_TYPES.GRASS.row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                screenX, screenY, SCALED_TILE, SCALED_TILE
            );

            // Draw overlay tile on top if it's an overlay type (mountains)
            if (tileType.overlay) {
                ctx.drawImage(
                    images.ground,
                    tileType.col * TILE_SIZE, tileType.row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                    screenX, screenY, SCALED_TILE, SCALED_TILE
                );
            } else if (tileType.isPlant) {
                // Draw animated plant decorations (4 frames, 200ms per frame)
                const plantFrame = Math.floor(Date.now() / 200) % 4;
                ctx.drawImage(
                    images.plant,
                    plantFrame * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE,
                    screenX+SCALED_TILE/4, screenY, SCALED_TILE/2, SCALED_TILE/2
                );
            } else if (tileType !== TILE_TYPES.GRASS) {
                // Draw non-overlay, non-grass tiles (like decorated grass)
                ctx.drawImage(
                    images.ground,
                    tileType.col * TILE_SIZE, tileType.row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                    screenX, screenY, SCALED_TILE, SCALED_TILE
                );
            }
        }
    }
}

function drawPlayer() {
    const screenX = player.x - cameraX + canvas.width / 2 - PLAYER_SCALED_SIZE / 2;
    const screenY = player.y - cameraY + canvas.height / 2 - PLAYER_SCALED_SIZE / 2;

    // Calculate sprite row based on direction and moving state
    // Idle: front=0, side=1, back=2
    // Walking: front=3, side=4, back=5
    const directionRow = { front: 0, side: 1, back: 2 };
    const baseRow = directionRow[player.direction] || 0;
    const frameY = player.moving ? baseRow + 3 : baseRow;
    const frameX = player.moving ? (player.frame % 6) : 0;

    ctx.save();

    // Only flip horizontally for side sprites when facing left
    if (player.direction === 'side' && !player.facingRight) {
        ctx.translate(screenX + PLAYER_SCALED_SIZE, screenY);
        ctx.scale(-1, 1);
        ctx.drawImage(
            images.player,
            frameX * PLAYER_TILE_SIZE, frameY * PLAYER_TILE_SIZE, PLAYER_TILE_SIZE, PLAYER_TILE_SIZE,
            0, 0, PLAYER_SCALED_SIZE, PLAYER_SCALED_SIZE
        );
    } else {
        ctx.drawImage(
            images.player,
            frameX * PLAYER_TILE_SIZE, frameY * PLAYER_TILE_SIZE, PLAYER_TILE_SIZE, PLAYER_TILE_SIZE,
            screenX, screenY, PLAYER_SCALED_SIZE, PLAYER_SCALED_SIZE
        );
    }
    ctx.restore();
}

function drawEnemies() {
    for (const enemy of enemies) {
        const screenX = enemy.x - cameraX + canvas.width / 2 - SCALED_TILE / 2;
        const screenY = enemy.y - cameraY + canvas.height / 2 - SCALED_TILE / 2;

        const frameX = 0;
        const frameY = enemy.frame;

        const monsterImage = images[`monster_${enemy.type}`];
        if (!monsterImage || !monsterImage.complete || monsterImage.naturalWidth === 0) continue;

        ctx.save();
        if (enemy.facingRight) {
            ctx.translate(screenX + SCALED_TILE, screenY);
            ctx.scale(-1, 1);
            ctx.drawImage(
                monsterImage,
                frameX * TILE_SIZE, frameY * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                0, 0, SCALED_TILE, SCALED_TILE
            );
        } else {
            ctx.drawImage(
                monsterImage,
                frameX * TILE_SIZE, frameY * TILE_SIZE, TILE_SIZE, TILE_SIZE,
                screenX, screenY, SCALED_TILE, SCALED_TILE
            );
        }
        ctx.restore();

        // Draw health bar
        const healthBarWidth = SCALED_TILE * 0.8;
        const healthBarHeight = 4;
        const healthPercent = enemy.health / enemy.maxHealth;
        const barX = screenX + (SCALED_TILE - healthBarWidth) / 2;
        const barY = screenY - 8;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, healthBarWidth, healthBarHeight);
        ctx.fillStyle = healthPercent > 0.5 ? '#4a4' : healthPercent > 0.25 ? '#aa4' : '#a44';
        ctx.fillRect(barX, barY, healthBarWidth * healthPercent, healthBarHeight);

        // Draw status effect indicators
        if (enemy.statusEffects) {
            // Blue tint overlay for frozen enemies
            if (enemy.statusEffects.freeze) {
                ctx.fillStyle = 'rgba(100, 180, 255, 0.4)';
                ctx.fillRect(screenX, screenY, SCALED_TILE, SCALED_TILE);
            }

            // Orange border for burning enemies
            if (enemy.statusEffects.burn) {
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 3;
                ctx.strokeRect(screenX + 2, screenY + 2, SCALED_TILE - 4, SCALED_TILE - 4);
            }
        }
    }
}

function drawProjectiles() {
    for (const proj of projectiles) {
        const screenX = proj.x - cameraX + canvas.width / 2 - SCALED_TILE / 2;
        const screenY = proj.y - cameraY + canvas.height / 2 - SCALED_TILE / 2;

        const projImage = images[proj.weaponType];
        if (!projImage || !projImage.complete || projImage.naturalWidth === 0) continue;

        ctx.save();
        ctx.translate(screenX + SCALED_TILE / 2, screenY + SCALED_TILE / 2);
        // Arrow and Kunai sprites point bottom-left to top-right (-45°), add π/4 to correct
        // Shuriken uses spinAngle for continuous rotation during flight
        let rotation;
        if (proj.weaponType === 'Shuriken') {
            rotation = proj.spinAngle;
        } else if (proj.weaponType === 'Arrow' || proj.weaponType === 'Kunai') {
            rotation = proj.angle + Math.PI / 4;
        } else {
            rotation = proj.angle;
        }
        ctx.rotate(rotation);
        ctx.drawImage(
            projImage,
            -SCALED_TILE / 2, -SCALED_TILE / 2, SCALED_TILE, SCALED_TILE
        );
        ctx.restore();
    }

    // Draw orbiting projectiles
    for (const proj of orbitingProjectiles) {
        const screenX = proj.x - cameraX + canvas.width / 2 - SCALED_TILE / 2;
        const screenY = proj.y - cameraY + canvas.height / 2 - SCALED_TILE / 2;

        const projImage = images[proj.weaponType];
        if (!projImage || !projImage.complete || projImage.naturalWidth === 0) continue;

        ctx.save();
        ctx.translate(screenX + SCALED_TILE / 2, screenY + SCALED_TILE / 2);

        // Circlets rotate based on their orbit angle
        if (proj.weaponType === 'Circlet') {
            ctx.rotate(proj.orbitAngle * 2);
        }

        ctx.drawImage(
            projImage,
            0, 0, TILE_SIZE, TILE_SIZE,
            -SCALED_TILE / 2, -SCALED_TILE / 2, SCALED_TILE, SCALED_TILE
        );
        ctx.restore();
    }
}

function drawExplosions() {
    const explosionImage = images['Explosion'];
    if (!explosionImage || !explosionImage.complete || explosionImage.naturalWidth === 0) return;

    const EXPLOSION_TILE_SIZE = 32; // 128x128 sprite sheet / 4x4 grid = 32px tiles

    for (const explosion of explosions) {
        // Calculate frame position in 4x4 sprite sheet (row by row, top-left first)
        const frameX = explosion.frame % 4;
        const frameY = Math.floor(explosion.frame / 4);

        // Center explosion on its position, scale to match explosion radius
        const explosionSize = explosion.radius;
        const screenX = explosion.x - cameraX + canvas.width / 2 - explosionSize / 2;
        const screenY = explosion.y - cameraY + canvas.height / 2 - explosionSize / 2;

        ctx.drawImage(
            explosionImage,
            frameX * EXPLOSION_TILE_SIZE, frameY * EXPLOSION_TILE_SIZE, EXPLOSION_TILE_SIZE, EXPLOSION_TILE_SIZE,
            screenX, screenY, explosionSize, explosionSize
        );
    }
}

function drawBlood() {
    const bloodImage = images['Blood'];
    if (!bloodImage || !bloodImage.complete || bloodImage.naturalWidth === 0) return;

    const BLOOD_TILE_SIZE = 32; // 128x128 sprite sheet / 4x4 grid = 32px tiles

    for (const blood of bloodSplatters) {
        // Calculate frame position in 4x4 sprite sheet (row by row, top-left first)
        const frameX = blood.frame % 4;
        const frameY = Math.floor(blood.frame / 4);

        const bloodSize = SCALED_TILE*2;

        const screenX = blood.x - cameraX + canvas.width / 2 - bloodSize / 2;
        const screenY = blood.y - cameraY + canvas.height / 2 - bloodSize / 2;

        ctx.drawImage(
            bloodImage,
            frameX * BLOOD_TILE_SIZE, frameY * BLOOD_TILE_SIZE, BLOOD_TILE_SIZE, BLOOD_TILE_SIZE,
            screenX, screenY, bloodSize, bloodSize
        );
    }
}

function drawPointsStatusBar() {
    const maxBarWidth = 400;
    const barWidth = Math.min(maxBarWidth, canvas.width - 40); // 20px padding on each side
    const barHeight = 30;
    const barX = (canvas.width - barWidth) / 2;
    const barY = 10;

    // Calculate progress toward next threshold
    let progress = 1;
    let displayText = `${Math.floor(score)}`;

    if (nextUpgradeIndex < UPGRADE_THRESHOLDS.length) {
        const nextThreshold = UPGRADE_THRESHOLDS[nextUpgradeIndex];
        const prevThreshold = nextUpgradeIndex > 0 ? UPGRADE_THRESHOLDS[nextUpgradeIndex - 1] : 0;
        const range = nextThreshold - prevThreshold;
        progress = range > 0 ? (score - prevThreshold) / range : 1;
        progress = Math.max(0, Math.min(1, progress));
        displayText = `${Math.floor(score)} / ${nextThreshold}`;
    }

    // Draw background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw progress fill
    ctx.fillStyle = '#c44a4a';
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    // Draw border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw text centered in bar
    ctx.fillStyle = 'white';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, barX + barWidth / 2, barY + barHeight / 2);
}

function drawWeaponList() {
    const iconSize = 48;
    const spacing = 8;
    const startX = 10;
    let startY = 50;

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const weapon of playerWeapons) {
        // Draw weapon icon (scaled from 16x16 to 48x48)
        const weaponImage = images[weapon.type];
        if (weaponImage && weaponImage.complete) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(weaponImage, startX, startY, iconSize, iconSize);
        }

        // Draw level text to the right of icon
        ctx.fillStyle = 'white';
        ctx.fillText(`Lv.${weapon.level + 1}`, startX + iconSize + spacing, startY + iconSize / 2);

        startY += iconSize + spacing;
    }

    // Draw owned scrolls below weapons
    for (const scroll of playerScrolls) {
        const scrollImage = images[scroll.type];
        if (scrollImage && scrollImage.complete) {
            ctx.imageSmoothingEnabled = false;

            // Check if scroll should be highlighted (just triggered)
            if (scroll.highlightUntil && gameTime < scroll.highlightUntil) {
                // Pulsing glow effect
                const progress = (scroll.highlightUntil - gameTime) / 400;
                const pulseIntensity = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4);

                // Draw glow behind the icon
                ctx.save();
                ctx.shadowColor = scroll.type === 'ScrollThunder' ? '#ffff00' :
                                  scroll.type === 'ScrollFire' ? '#ff6600' : '#00ffff';
                ctx.shadowBlur = 15 * pulseIntensity;
                ctx.globalAlpha = 0.8 + 0.2 * pulseIntensity;
                ctx.drawImage(scrollImage, startX, startY, iconSize, iconSize);
                ctx.restore();
            } else {
                ctx.drawImage(scrollImage, startX, startY, iconSize, iconSize);
            }
        }

        startY += iconSize + spacing;
    }
}

function drawJoystick() {
    if (!isMobile || gameState !== 'playing') return;

    // Draw joystick base (semi-transparent circle)
    if (joystick.active) {
        // Active joystick - draw at touch position
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(joystick.baseX, joystick.baseY, JOYSTICK_BASE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw joystick knob
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(joystick.knobX, joystick.knobY, JOYSTICK_KNOB_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.globalAlpha = 1.0;
    } else {
        // Inactive - show hint indicator in bottom right
        const hintX = canvas.width - 80;
        const hintY = canvas.height - 100;

        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(hintX, hintY, JOYSTICK_BASE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Small knob in center
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(hintX, hintY, JOYSTICK_KNOB_RADIUS * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0;
    }
}

function drawPauseButton() {
    if (gameState !== 'playing') return;

    const size = 40;
    const margin = 10;
    const x = canvas.width - size - margin;
    const y = margin;

    // Draw button background
    ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // Draw pause icon (two vertical bars)
    ctx.fillStyle = 'white';
    const barWidth = 6;
    const barHeight = 20;
    const barY = y + (size - barHeight) / 2;
    ctx.fillRect(x + size/2 - barWidth - 3, barY, barWidth, barHeight);
    ctx.fillRect(x + size/2 + 3, barY, barWidth, barHeight);
}

function getPauseButtonBounds() {
    const size = 40;
    const margin = 10;
    return {
        x: canvas.width - size - margin,
        y: margin,
        width: size,
        height: size
    };
}

function drawUI() {
    drawPointsStatusBar();
    drawWeaponList();
    drawJoystick();
    drawPauseButton();
}

function getGameOverButtonBounds() {
    const restartWidth = 200;
    const restartHeight = 50;
    const fundWidth = 280;
    const fundHeight = 45;
    const githubSize = 45;
    const buttonSpacing = 15;

    const fundY = canvas.height / 2 + 95;
    const fundX = (canvas.width - fundWidth - buttonSpacing - githubSize) / 2;

    return {
        restart: {
            x: (canvas.width - restartWidth) / 2,
            y: canvas.height / 2 - 30,
            width: restartWidth,
            height: restartHeight
        },
        fund: {
            x: fundX,
            y: fundY,
            width: fundWidth,
            height: fundHeight
        },
        github: {
            x: fundX + fundWidth + buttonSpacing,
            y: fundY,
            width: githubSize,
            height: fundHeight
        }
    };
}

function drawHeart(x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size * 0.5, -size * 0.3, -size, size * 0.2, 0, size);
    ctx.bezierCurveTo(size, size * 0.2, size * 0.5, -size * 0.3, 0, size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawGitHubIcon(x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    // Circle (head)
    ctx.beginPath();
    ctx.arc(0, -size * 0.1, size * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Body/tentacles
    ctx.beginPath();
    ctx.arc(0, size * 0.5, size * 0.25, Math.PI, 0, true);
    ctx.fill();

    // Arms
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, size * 0.1);
    ctx.quadraticCurveTo(-size * 0.5, size * 0.4, -size * 0.3, size * 0.6);
    ctx.lineWidth = size * 0.12;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.35, size * 0.1);
    ctx.quadraticCurveTo(size * 0.5, size * 0.4, size * 0.3, size * 0.6);
    ctx.stroke();

    ctx.restore();
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 120);

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText(`Final Score: ${Math.floor(score)}`, canvas.width / 2, canvas.height / 2 - 70);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`Best: ${Math.floor(highScore)}`, canvas.width / 2, canvas.height / 2 - 45);

    const buttons = getGameOverButtonBounds();

    // Restart button
    ctx.fillStyle = '#4a7a4a';
    ctx.fillRect(buttons.restart.x, buttons.restart.y, buttons.restart.width, buttons.restart.height);
    ctx.strokeStyle = '#6aca6a';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.restart.x, buttons.restart.y, buttons.restart.width, buttons.restart.height);

    ctx.fillStyle = 'white';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText('RESTART', canvas.width / 2, buttons.restart.y + buttons.restart.height / 2);

    // Credits
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('Created by AgentRateLimit', canvas.width / 2, canvas.height / 2 + 50);

    // Patreon message
    ctx.fillStyle = '#ccc';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('Digital wealth for everyone by open source.', canvas.width / 2, canvas.height / 2 + 75);

    // Fund the mission button
    ctx.fillStyle = '#8a2a4a';
    ctx.fillRect(buttons.fund.x, buttons.fund.y, buttons.fund.width, buttons.fund.height);
    ctx.strokeStyle = '#f96854';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.fund.x, buttons.fund.y, buttons.fund.width, buttons.fund.height);

    // Heart icon
    ctx.fillStyle = '#ff6b6b';
    drawHeart(buttons.fund.x + 25, buttons.fund.y + buttons.fund.height / 2 - 8, 12);

    ctx.fillStyle = 'white';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Fund the Mission', buttons.fund.x + buttons.fund.width / 2 + 10, buttons.fund.y + buttons.fund.height / 2);

    // GitHub button
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(buttons.github.x, buttons.github.y, buttons.github.width, buttons.github.height);
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.github.x, buttons.github.y, buttons.github.width, buttons.github.height);

    // GitHub icon
    ctx.fillStyle = 'white';
    drawGitHubIcon(buttons.github.x + buttons.github.width / 2, buttons.github.y + buttons.github.height / 2, 18);

    // Patreon progress bar
    drawPatreonProgress(buttons.fund.y + buttons.fund.height + 20);
}

function drawPatreonProgress(startY) {
    const maxBarWidth = 340;
    const barWidth = Math.min(maxBarWidth, canvas.width - 40);
    const barHeight = 26;
    const barX = (canvas.width - barWidth) / 2;
    const barY = startY;

    // Calculate progress
    const progress = Math.min(1, patreonCurrent / PATREON_GOAL);

    // Draw bar background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw progress fill with gradient effect
    if (progress > 0) {
        ctx.fillStyle = '#f96854';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        // Highlight on top of progress
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight / 3);
    }

    // Draw border
    ctx.strokeStyle = '#f96854';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw amount text
    ctx.fillStyle = 'white';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${patreonCurrent} / $${PATREON_GOAL}`, canvas.width / 2, barY + barHeight / 2);

    // Draw goal description
    ctx.fillStyle = '#aaa';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('Goal: New game every week!', canvas.width / 2, barY + barHeight + 14);
}

function getPauseMenuButtonBounds() {
    const resumeWidth = 200;
    const resumeHeight = 50;
    const fundWidth = 280;
    const fundHeight = 45;
    const githubSize = 45;
    const moreGamesWidth = 280;
    const moreGamesHeight = 45;
    const buttonSpacing = 15;

    const resumeY = canvas.height / 2 - 80;
    const fundY = canvas.height / 2 + 30;
    const fundX = (canvas.width - fundWidth - buttonSpacing - githubSize) / 2;
    const moreGamesY = fundY + fundHeight + 80; // After patreon progress bar (bar height 26 + text 14 + spacing)

    return {
        resume: {
            x: (canvas.width - resumeWidth) / 2,
            y: resumeY,
            width: resumeWidth,
            height: resumeHeight
        },
        fund: {
            x: fundX,
            y: fundY,
            width: fundWidth,
            height: fundHeight
        },
        github: {
            x: fundX + fundWidth + buttonSpacing,
            y: fundY,
            width: githubSize,
            height: fundHeight
        },
        moreGames: {
            x: (canvas.width - moreGamesWidth) / 2,
            y: moreGamesY,
            width: moreGamesWidth,
            height: moreGamesHeight
        }
    };
}

function drawPauseMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '32px "Press Start 2P", monospace';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 160);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = 'white';
    ctx.fillText(`Score: ${Math.floor(score)}`, canvas.width / 2, canvas.height / 2 - 120);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`Best: ${Math.floor(highScore)}`, canvas.width / 2, canvas.height / 2 - 100);

    const buttons = getPauseMenuButtonBounds();

    // Resume button
    ctx.fillStyle = '#4a7a4a';
    ctx.fillRect(buttons.resume.x, buttons.resume.y, buttons.resume.width, buttons.resume.height);
    ctx.strokeStyle = '#6aca6a';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.resume.x, buttons.resume.y, buttons.resume.width, buttons.resume.height);

    ctx.fillStyle = 'white';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText('RESUME', canvas.width / 2, buttons.resume.y + buttons.resume.height / 2);

    // Credits
    ctx.fillStyle = '#aaa';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('Created by AgentRateLimit', canvas.width / 2, buttons.resume.y + buttons.resume.height + 25);

    // Patreon message
    ctx.fillStyle = '#ccc';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('Digital wealth for everyone by open source.', canvas.width / 2, buttons.resume.y + buttons.resume.height + 45);

    // Fund the mission button
    ctx.fillStyle = '#8a2a4a';
    ctx.fillRect(buttons.fund.x, buttons.fund.y, buttons.fund.width, buttons.fund.height);
    ctx.strokeStyle = '#f96854';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.fund.x, buttons.fund.y, buttons.fund.width, buttons.fund.height);

    // Heart icon
    ctx.fillStyle = '#ff6b6b';
    drawHeart(buttons.fund.x + 25, buttons.fund.y + buttons.fund.height / 2 - 8, 12);

    ctx.fillStyle = 'white';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Fund the Mission', buttons.fund.x + buttons.fund.width / 2 + 10, buttons.fund.y + buttons.fund.height / 2);

    // GitHub button
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(buttons.github.x, buttons.github.y, buttons.github.width, buttons.github.height);
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.github.x, buttons.github.y, buttons.github.width, buttons.github.height);

    // GitHub icon
    ctx.fillStyle = 'white';
    drawGitHubIcon(buttons.github.x + buttons.github.width / 2, buttons.github.y + buttons.github.height / 2, 18);

    // Patreon progress bar
    drawPatreonProgress(buttons.fund.y + buttons.fund.height + 20);

    // More games button
    ctx.fillStyle = '#2a4a6a';
    ctx.fillRect(buttons.moreGames.x, buttons.moreGames.y, buttons.moreGames.width, buttons.moreGames.height);
    ctx.strokeStyle = '#4a8aca';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttons.moreGames.x, buttons.moreGames.y, buttons.moreGames.width, buttons.moreGames.height);

    ctx.fillStyle = 'white';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('More Games', buttons.moreGames.x + buttons.moreGames.width / 2, buttons.moreGames.y + buttons.moreGames.height / 2);
}

function drawReadyOverlay() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pulsing "GET READY" text
    const pulse = 0.9 + Math.sin(Date.now() / 80) * 0.1;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = '#ffcc00';
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GET READY!', 0, 0);

    ctx.restore();
}

function formatStatChanges(weaponData, currentLevel, nextLevel) {
    const current = weaponData.levels[currentLevel];
    const next = weaponData.levels[nextLevel];
    const changes = [];

    if (current.damage !== next.damage) {
        changes.push(`${current.damage}->${next.damage} dmg`);
    }
    if (current.cooldown !== undefined && next.cooldown !== undefined && current.cooldown !== next.cooldown) {
        changes.push(`${current.cooldown}s->${next.cooldown}s`);
    }
    if (current.projectiles !== undefined && next.projectiles !== undefined && current.projectiles !== next.projectiles) {
        const diff = next.projectiles - current.projectiles;
        changes.push(`+${diff} proj`);
    }

    return changes;
}

function formatNewWeaponStats(weaponData) {
    const level = weaponData.levels[0];
    const stats = [];

    stats.push(`${level.damage} dmg`);
    if (level.cooldown !== undefined) {
        stats.push(`${level.cooldown}s`);
    }
    if (level.projectiles !== undefined) {
        stats.push(`${level.projectiles} proj`);
    }

    return stats;
}

function drawUpgradeMenu() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADE!', canvas.width / 2, 80);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText(`Score: ${Math.floor(score)}`, canvas.width / 2, 110);

    const buttonWidth = 280;
    const buttonHeight = 80;
    const buttonSpacing = 15;
    const iconSize = 50;
    const iconPadding = 10;
    const totalHeight = upgradeOptions.length * (buttonHeight + buttonSpacing) - buttonSpacing;
    const startY = (canvas.height - totalHeight) / 2 + 20;

    for (let i = 0; i < upgradeOptions.length; i++) {
        const option = upgradeOptions[i];
        const buttonX = (canvas.width - buttonWidth) / 2;
        const buttonY = startY + i * (buttonHeight + buttonSpacing);

        // Button background and border - different colors for new vs upgrade vs scroll
        if (option.isScroll) {
            ctx.fillStyle = '#4a2a5a';  // Purple tint for scrolls
            ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
            ctx.strokeStyle = '#9a4aca';
            ctx.lineWidth = 3;
            ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        } else if (option.isNew) {
            ctx.fillStyle = '#2a5a4a';  // Green tint for new weapons
            ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
            ctx.strokeStyle = '#4aca8a';
            ctx.lineWidth = 3;
            ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        } else {
            ctx.fillStyle = '#2a4a6a';  // Blue tint for upgrades
            ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
            ctx.strokeStyle = '#4a8aca';
            ctx.lineWidth = 2;
            ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        }

        // Draw weapon icon (scrolls have custom layout)
        const weaponImage = images[option.type];
        if (weaponImage && weaponImage.complete && weaponImage.naturalWidth > 0) {
            if (option.isScroll) {
                // Scroll layout: icon at top-left, name below icon
                const scrollIconSize = 40;
                const iconX = buttonX + iconPadding;
                const iconY = buttonY + 8;
                ctx.drawImage(weaponImage, iconX, iconY, scrollIconSize, scrollIconSize);

                // Name below icon
                ctx.textAlign = 'center';
                ctx.fillStyle = 'white';
                ctx.font = '8px "Press Start 2P", monospace';
                const displayName = option.type.replace('Scroll', '');
                ctx.fillText(displayName, iconX + scrollIconSize / 2, buttonY + 68);
            } else {
                const iconX = buttonX + iconPadding;
                const iconY = buttonY + (buttonHeight - iconSize) / 2;
                ctx.drawImage(weaponImage, iconX, iconY, iconSize, iconSize);
            }
        }

        // Text area starts after icon
        const textX = buttonX + iconPadding + iconSize + 15;
        const textWidth = buttonWidth - iconSize - iconPadding - 25;
        const textCenterX = textX + textWidth / 2;

        ctx.textAlign = 'center';
        const weaponData = weaponsData.find(w => w.type === option.type);

        if (option.isScroll) {
            const config = SCROLL_CONFIG[option.type];

            // Description (2 lines) to the right of icon
            ctx.fillStyle = '#c8f';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillText(config.desc[0], textCenterX, buttonY + 22);
            ctx.fillText(config.desc[1], textCenterX, buttonY + 38);

            // Cooldown time
            ctx.fillStyle = '#aaa';
            const minSec = Math.round(config.minInterval / 1000);
            const maxSec = Math.round(config.maxInterval / 1000);
            ctx.fillText(`${minSec}-${maxSec}s cooldown`, textCenterX, buttonY + 58);
        } else if (option.isNew) {
            // NEW badge
            ctx.fillStyle = '#4aca8a';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillText('NEW!', textCenterX, buttonY + 18);

            // Title
            ctx.fillStyle = 'white';
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillText(option.type, textCenterX, buttonY + 38);

            // Stats
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = '#8f8';
            if (weaponData) {
                const stats = formatNewWeaponStats(weaponData);
                ctx.fillText(stats.join(' '), textCenterX, buttonY + 58);
            }
        } else {
            // Title with level
            ctx.fillStyle = 'white';
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillText(option.type, textCenterX, buttonY + 22);

            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillStyle = '#aaa';
            ctx.fillText(`Lv${option.currentLevel + 1} -> Lv${option.currentLevel + 2}`, textCenterX, buttonY + 40);

            // Stat changes
            ctx.fillStyle = '#8f8';
            if (weaponData) {
                const changes = formatStatChanges(weaponData, option.currentLevel, option.currentLevel + 1);
                if (changes.length > 0) {
                    ctx.fillText(changes.join(' '), textCenterX, buttonY + 58);
                }
            }
        }
    }
}

// Gamepad functions
function pollGamepad() {
    if (!gamepad.connected || gamepad.index === null) return;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepad.index];
    if (!gp) return;

    // Apply dead zone and normalize analog stick values
    function applyDeadZone(value) {
        if (Math.abs(value) < gamepad.deadZone) return 0;
        // Remap to 0-1 range after dead zone
        const sign = value > 0 ? 1 : -1;
        return sign * (Math.abs(value) - gamepad.deadZone) / (1 - gamepad.deadZone);
    }

    // Left stick (axes 0 and 1)
    gamepad.leftStick.x = applyDeadZone(gp.axes[0] || 0);
    gamepad.leftStick.y = applyDeadZone(gp.axes[1] || 0);

    // Start button state (button 9 on standard gamepad)
    gamepad.buttons.prevStart = gamepad.buttons.start;
    gamepad.buttons.start = gp.buttons[9] ? gp.buttons[9].pressed : false;
}

function handleGamepadButtons() {
    if (!gamepad.connected) return;

    // Start button: Toggle pause (edge-triggered)
    if (gamepad.buttons.start && !gamepad.buttons.prevStart) {
        if (gameState === 'playing' && readyTimer <= 0) {
            gameState = 'paused';
        } else if (gameState === 'paused') {
            readyTimer = POST_UPGRADE_DELAY;
            gameState = 'playing';
        }
    }
}

// Update functions
function updatePlayer(dt) {
    let moveX = 0;
    let moveY = 0;
    let isMoving = false;

    // Calculate desired movement (with speed boost if active)
    const speedMultiplier = speedBoostTimer > 0 ? SPEED_BOOST_MULTIPLIER : 1;

    // Gamepad: Use left analog stick (highest priority)
    if (gamepad.connected && (gamepad.leftStick.x !== 0 || gamepad.leftStick.y !== 0)) {
        moveX = gamepad.leftStick.x * PLAYER_SPEED * speedMultiplier * dt;
        moveY = gamepad.leftStick.y * PLAYER_SPEED * speedMultiplier * dt;
        isMoving = true;

        // Update facing direction based on gamepad
        if (gamepad.leftStick.x !== 0) {
            player.facingRight = gamepad.leftStick.x > 0;
        }
        player.moving = false; // Cancel click-to-move
    }
    // Keyboard: Use arrow keys / WASD (second priority)
    else if (keyboard.up || keyboard.down || keyboard.left || keyboard.right) {
        const kbX = (keyboard.right ? 1 : 0) - (keyboard.left ? 1 : 0);
        const kbY = (keyboard.down ? 1 : 0) - (keyboard.up ? 1 : 0);

        // Normalize diagonal movement
        const length = Math.sqrt(kbX * kbX + kbY * kbY);
        if (length > 0) {
            moveX = (kbX / length) * PLAYER_SPEED * speedMultiplier * dt;
            moveY = (kbY / length) * PLAYER_SPEED * speedMultiplier * dt;
            isMoving = true;

            // Update facing direction based on keyboard
            if (kbX !== 0) {
                player.facingRight = kbX > 0;
            }
            player.moving = false; // Cancel click-to-move
            player.targetX = player.x; // Clear old target
            player.targetY = player.y;
        }
    }
    // Mobile: Use joystick input
    else if (isMobile && (joystick.dirX !== 0 || joystick.dirY !== 0)) {
        moveX = joystick.dirX * PLAYER_SPEED * speedMultiplier * dt;
        moveY = joystick.dirY * PLAYER_SPEED * speedMultiplier * dt;
        isMoving = true;

        // Update facing direction based on joystick
        if (joystick.dirX !== 0) {
            player.facingRight = joystick.dirX > 0;
        }
    }
    // Desktop: Use mouse-to-move (continuous while held)
    else if (!isMobile && (mouseHeld || player.moving)) {
        // Continuously update target while mouse is held
        if (mouseHeld) {
            player.targetX = mouseScreenX + cameraX - canvas.width / 2;
            player.targetY = mouseScreenY + cameraY - canvas.height / 2;
            player.moving = true;
            // Update arrow weapon facing angle
            playerFacingAngle = Math.atan2(player.targetY - player.y, player.targetX - player.x);
        }

        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5 && !mouseHeld) {
            player.moving = false;
        } else if (dist >= 5) {
            moveX = (dx / dist) * PLAYER_SPEED * speedMultiplier * dt;
            moveY = (dy / dist) * PLAYER_SPEED * speedMultiplier * dt;
            isMoving = true;

            // Update facing direction
            if (dx !== 0) {
                player.facingRight = dx > 0;
            }
        }
    }

    // Apply movement if any
    if (isMoving) {
        const newX = player.x + moveX;
        const newY = player.y + moveY;

        if (!isPositionBlocked(newX, newY)) {
            // No collision, move normally
            player.x = newX;
            player.y = newY;
        } else {
            // Try wall-sliding: X-only movement
            if (!isPositionBlocked(newX, player.y)) {
                player.x = newX;
            }
            // Try wall-sliding: Y-only movement
            else if (!isPositionBlocked(player.x, newY)) {
                player.y = newY;
            }
            // Completely blocked - don't move
        }

        // Animation
        player.frameTime += dt;
        if (player.frameTime > 0.15) {
            player.frameTime = 0;
            player.frame = (player.frame + 1) % 6;
        }

        // Set direction based on primary movement axis
        const absX = Math.abs(moveX);
        const absY = Math.abs(moveY);
        if (absY > absX) {
            // Vertical movement dominant
            player.direction = moveY < 0 ? 'back' : 'front';
        } else {
            // Horizontal movement dominant
            player.direction = 'side';
            player.facingRight = moveX > 0;
        }
    }

    // Update player.moving flag for animation rendering (needed for joystick)
    player.moving = isMoving;

    // Update camera to follow player with dead zone
    const playerScreenX = player.x - cameraX;
    const playerScreenY = player.y - cameraY;

    if (Math.abs(playerScreenX) > CENTER_DEAD_ZONE) {
        cameraX = player.x - Math.sign(playerScreenX) * CENTER_DEAD_ZONE;
    }
    if (Math.abs(playerScreenY) > CENTER_DEAD_ZONE) {
        cameraY = player.y - Math.sign(playerScreenY) * CENTER_DEAD_ZONE;
    }
}

function updateEnemies(dt) {
    for (const enemy of enemies) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Only trigger game over if not invincible
        if (dist < SCALED_TILE * 0.4 && invincibilityTimer <= 0) {
            gameState = 'gameover';
            // Save high score if current score is higher
            if (score > highScore) {
                highScore = score;
                try {
                    localStorage.setItem('survivalHighScore', Math.floor(highScore).toString());
                } catch (error) {
                    // localStorage not available
                }
            }
            return;
        }

        // Skip movement for frozen enemies
        const isFrozen = enemy.statusEffects?.freeze;

        if (dist > 0 && !isFrozen) {
            const speed = ENEMY_BASE_SPEED * enemy.speed;
            const moveX = (dx / dist) * speed * dt;
            const moveY = (dy / dist) * speed * dt;

            const newX = enemy.x + moveX;
            const newY = enemy.y + moveY;

            // Try direct movement first
            if (!isPositionBlocked(newX, newY)) {
                enemy.x = newX;
                enemy.y = newY;
            } else {
                // Try wall-sliding: X-only movement
                if (!isPositionBlocked(newX, enemy.y)) {
                    enemy.x = newX;
                }
                // Try wall-sliding: Y-only movement
                else if (!isPositionBlocked(enemy.x, newY)) {
                    enemy.y = newY;
                }
                // Try perpendicular movement if completely stuck
                else {
                    // Try moving perpendicular to get around obstacle
                    const perpX = enemy.x + (dy / dist) * speed * dt;
                    const perpY = enemy.y - (dx / dist) * speed * dt;
                    if (!isPositionBlocked(perpX, enemy.y)) {
                        enemy.x = perpX;
                    } else if (!isPositionBlocked(enemy.x, perpY)) {
                        enemy.y = perpY;
                    }
                }
            }

            enemy.facingRight = dx > 0;
        }

        // Animation
        enemy.frameTime += dt;
        if (enemy.frameTime > 0.15) {
            enemy.frameTime = 0;
            enemy.frame = (enemy.frame + 1) % 4;
        }
    }
}

function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];

        // Handle bomb projectiles
        if (proj.isBomb) {
            // Update fuse timer
            proj.fuseTimer += dt * 1000;

            // Move bomb until it reaches travel distance
            if (proj.distanceTraveled < BOMB_TRAVEL_DISTANCE) {
                const moveX = Math.cos(proj.angle) * PROJECTILE_SPEED * dt;
                const moveY = Math.sin(proj.angle) * PROJECTILE_SPEED * dt;
                proj.x += moveX;
                proj.y += moveY;
                proj.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
            }

            // Check if bomb should explode
            if (proj.fuseTimer >= proj.fuseTime && !proj.hasExploded) {
                proj.hasExploded = true;

                // Create explosion animation
                explosions.push({
                    x: proj.x,
                    y: proj.y,
                    frame: 0,
                    frameTimer: 0,
                    radius: proj.explodeRadius
                });

                // Deal damage to all enemies within explosion radius
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    const dx = proj.x - enemy.x;
                    const dy = proj.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < proj.explodeRadius) {
                        enemy.health -= proj.damage;
                        bloodSplatters.push({ x: enemy.x, y: enemy.y, frame: 0, frameTimer: 0 });

                        if (enemy.health <= 0) {
                            score += enemy.maxHealth;
                            enemies.splice(j, 1);
                            checkForUpgrade();
                        }
                    }
                }

                // Remove exploded bomb
                projectiles.splice(i, 1);
                continue;
            }
        } else {
            // Normal projectile movement
            proj.x += Math.cos(proj.angle) * PROJECTILE_SPEED * dt;
            proj.y += Math.sin(proj.angle) * PROJECTILE_SPEED * dt;

            // Update shuriken spin
            if (proj.weaponType === 'Shuriken') {
                proj.spinAngle += SHURIKEN_SPIN_SPEED * dt;
            }

            // Remove if off screen
            const screenX = proj.x - cameraX;
            const screenY = proj.y - cameraY;
            if (Math.abs(screenX) > canvas.width || Math.abs(screenY) > canvas.height) {
                projectiles.splice(i, 1);
                continue;
            }

            // Check collision with enemies
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                const dx = proj.x - enemy.x;
                const dy = proj.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < SCALED_TILE * 0.5) {
                    // Apply damage
                    enemy.health -= proj.damage;
                    bloodSplatters.push({ x: enemy.x, y: enemy.y, frame: 0, frameTimer: 0 });
                    projectiles.splice(i, 1);

                    if (enemy.health <= 0) {
                        // Award points based on monster's max health
                        score += enemy.maxHealth;
                        enemies.splice(j, 1);

                        // Check for upgrade
                        checkForUpgrade();
                    }
                    break;
                }
            }
        }
    }
}

function checkForUpgrade() {
    if (nextUpgradeIndex < UPGRADE_THRESHOLDS.length &&
        score >= UPGRADE_THRESHOLDS[nextUpgradeIndex]) {
        nextUpgradeIndex++;
        showUpgradeMenu();
    }
}

function showUpgradeMenu() {
    gameState = 'upgrading';
    upgradeOptions = generateUpgradeOptions();
}

function generateUpgradeOptions() {
    const options = [];

    // Get weapons that can be upgraded (not at max level)
    for (const weapon of playerWeapons) {
        const weaponData = weaponsData.find(w => w.type === weapon.type);
        if (weaponData && weapon.level < weaponData.levels.length - 1) {
            options.push({
                type: weapon.type,
                isNew: false,
                currentLevel: weapon.level
            });
        }
    }

    // Get weapons that can be added (not already owned)
    const ownedTypes = playerWeapons.map(w => w.type);
    for (const weaponData of weaponsData) {
        if (!ownedTypes.includes(weaponData.type)) {
            options.push({
                type: weaponData.type,
                isNew: true
            });
        }
    }

    // Get scrolls that can be added (not already owned)
    const ownedScrolls = playerScrolls.map(s => s.type);
    for (const scrollType of SCROLL_TYPES) {
        if (!ownedScrolls.includes(scrollType)) {
            options.push({
                type: scrollType,
                isScroll: true
            });
        }
    }

    // Shuffle and pick up to 3 options
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    return options.slice(0, 3);
}

function getCurrentSpawnPhase() {
    const timeSeconds = gameTime / 1000;
    let currentPhase = spawnPhasesData[0];

    for (const phase of spawnPhasesData) {
        if (phase.startTime <= timeSeconds) {
            currentPhase = phase;
        } else {
            break;
        }
    }

    return currentPhase;
}

function selectEnemyFromPhase(enemyWeights) {
    // Calculate total weight
    let totalWeight = 0;
    for (const weight of Object.values(enemyWeights)) {
        totalWeight += weight;
    }

    // Pick a random value in the total weight range
    let randomValue = Math.random() * totalWeight;

    // Find which enemy this falls into
    for (const [enemyType, weight] of Object.entries(enemyWeights)) {
        randomValue -= weight;
        if (randomValue <= 0) {
            // Find the monster data for this type
            const monsterData = monstersData.find(m => m.type === enemyType);
            if (monsterData) {
                return monsterData;
            }
        }
    }

    // Fallback to first enemy type if something goes wrong
    const firstType = Object.keys(enemyWeights)[0];
    return monstersData.find(m => m.type === firstType) || monstersData[0];
}

function spawnEnemy() {
    // Get current spawn phase and select enemy using weighted probability
    const phase = getCurrentSpawnPhase();
    const monsterData = selectEnemyFromPhase(phase.enemies);

    const margin = SCALED_TILE * 2;
    let x, y;
    let attempts = 0;
    const maxAttempts = 10;

    // Try to find a valid spawn position
    do {
        const side = Math.floor(Math.random() * 4);

        switch (side) {
            case 0: // Top
                x = cameraX + (Math.random() - 0.5) * canvas.width;
                y = cameraY - canvas.height / 2 - margin;
                break;
            case 1: // Right
                x = cameraX + canvas.width / 2 + margin;
                y = cameraY + (Math.random() - 0.5) * canvas.height;
                break;
            case 2: // Bottom
                x = cameraX + (Math.random() - 0.5) * canvas.width;
                y = cameraY + canvas.height / 2 + margin;
                break;
            case 3: // Left
                x = cameraX - canvas.width / 2 - margin;
                y = cameraY + (Math.random() - 0.5) * canvas.height;
                break;
        }

        attempts++;
    } while (isPositionBlocked(x, y) && attempts < maxAttempts);

    // Only spawn if we found a valid position
    if (!isPositionBlocked(x, y)) {
        enemies.push({
            x: x,
            y: y,
            type: monsterData.type,
            health: monsterData.health,
            maxHealth: monsterData.health,
            speed: monsterData.speed,
            frame: 0,
            frameTime: 0,
            facingRight: true
        });
    }
}

function spawnSwarm() {
    // Get current phase but bias toward weaker enemies for swarms
    const phase = getCurrentSpawnPhase();
    const timeSeconds = gameTime / 1000;

    // Create swarm-specific weights that favor weaker enemies
    // Take top 3 enemies by weight from current phase
    const sortedEnemies = Object.entries(phase.enemies)
        .sort((a, b) => b[1] - a[1])  // Sort by weight descending
        .slice(0, 3);  // Take top 3 most common enemies

    const swarmWeights = {};
    for (const [type, weight] of sortedEnemies) {
        swarmWeights[type] = weight;
    }

    // Determine swarm size (increases slightly with game time)
    const baseCount = SWARM_MIN_COUNT + Math.floor(timeSeconds / 60);
    const swarmCount = Math.min(SWARM_MAX_COUNT, baseCount + Math.floor(Math.random() * 5));

    for (let i = 0; i < swarmCount; i++) {
        // Pick enemy using swarm-biased weights
        const monsterData = selectEnemyFromPhase(swarmWeights);

        // Spawn in a ring around the player
        const angle = (Math.PI * 2 * i) / swarmCount + (Math.random() - 0.5) * 0.5;
        const radius = SWARM_SPAWN_RADIUS_MIN + Math.random() * (SWARM_SPAWN_RADIUS_MAX - SWARM_SPAWN_RADIUS_MIN);

        const x = player.x + Math.cos(angle) * radius;
        const y = player.y + Math.sin(angle) * radius;

        // Only spawn if position is valid
        if (!isPositionBlocked(x, y)) {
            enemies.push({
                x: x,
                y: y,
                type: monsterData.type,
                health: monsterData.health,
                maxHealth: monsterData.health,
                speed: monsterData.speed,
                frame: 0,
                frameTime: 0,
                facingRight: player.x > x
            });
        }
    }
}

function updateWeapons(dt) {
    for (const weapon of playerWeapons) {
        // Skip cooldown-based weapons (Circlet is persistent)
        if (weapon.type === 'Circlet') continue;

        weapon.cooldownTimer += dt * 1000;

        const weaponData = weaponsData.find(w => w.type === weapon.type);
        if (!weaponData) continue;

        const levelData = weaponData.levels[weapon.level];
        const cooldownMs = (levelData.cooldown || 1) * 1000;

        if (weapon.cooldownTimer >= cooldownMs) {
            weapon.cooldownTimer = 0;
            fireWeapon(weapon.type, levelData);
        }
    }
}

function fireWeapon(type, levelData) {
    switch (type) {
        case 'Arrow':
            fireArrow(levelData);
            break;
        case 'Shuriken':
            fireShuriken(levelData);
            break;
        case 'Kunai':
            fireKunai(levelData);
            break;
        case 'Bomb':
            fireBomb(levelData);
            break;
        // Circlet doesn't fire - it's persistent
    }
}

function fireArrow(levelData) {
    // Shoot toward last click/touch direction
    projectiles.push({
        x: player.x,
        y: player.y,
        angle: playerFacingAngle,
        damage: levelData.damage,
        weaponType: 'Arrow'
    });
}

function fireShuriken(levelData) {
    // Shoot N projectiles in equal angles around player
    const count = levelData.projectiles || 1;
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;
        projectiles.push({
            x: player.x,
            y: player.y,
            angle: angle,
            spinAngle: 0,
            damage: levelData.damage,
            weaponType: 'Shuriken'
        });
    }
}

function fireKunai(levelData) {
    // Shoot toward nearest enemy
    if (enemies.length === 0) {
        // No enemies, shoot in facing direction
        projectiles.push({
            x: player.x,
            y: player.y,
            angle: player.facingRight ? 0 : Math.PI,
            damage: levelData.damage,
            weaponType: 'Kunai'
        });
        return;
    }

    let nearestDist = Infinity;
    let nearestEnemy = null;

    for (const enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = enemy;
        }
    }

    if (nearestEnemy) {
        const angle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
        projectiles.push({
            x: player.x,
            y: player.y,
            angle: angle,
            damage: levelData.damage,
            weaponType: 'Kunai'
        });
    }
}

function fireBomb(levelData) {
    // Throw in random direction
    const angle = Math.random() * Math.PI * 2;

    projectiles.push({
        x: player.x,
        y: player.y,
        angle: angle,
        damage: levelData.damage,
        weaponType: 'Bomb',
        isBomb: true,
        fuseTimer: 0,
        fuseTime: BOMB_FUSE_TIME,
        explodeRadius: BOMB_EXPLODE_RADIUS,
        hasExploded: false,
        distanceTraveled: 0
    });
}

function updateCirclets() {
    // Get Circlet weapon from playerWeapons
    const CircletWeapon = playerWeapons.find(w => w.type === 'Circlet');
    if (!CircletWeapon) return;

    // Get weapon data for projectile count
    const weaponData = weaponsData.find(w => w.type === 'Circlet');
    if (!weaponData) return;

    const levelData = weaponData.levels[CircletWeapon.level];
    const count = levelData.projectiles || 1;

    // Clear existing Circlets
    orbitingProjectiles = [];

    // Create N Circlets at equal angles
    const angleStep = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
        const startAngle = i * angleStep;
        orbitingProjectiles.push({
            orbitAngle: startAngle,
            orbitRadius: Circlet_ORBIT_RADIUS,
            orbitSpeed: Circlet_ORBIT_SPEED,
            damage: levelData.damage,
            weaponType: 'Circlet',
            hitCooldowns: {}, // Track per-enemy hit cooldowns
            x: player.x + Math.cos(startAngle) * Circlet_ORBIT_RADIUS,
            y: player.y + Math.sin(startAngle) * Circlet_ORBIT_RADIUS
        });
    }
}

function updateOrbitingProjectiles(dt) {
    for (const proj of orbitingProjectiles) {
        // Update orbit angle
        proj.orbitAngle += proj.orbitSpeed * dt;

        // Update position relative to player
        proj.x = player.x + Math.cos(proj.orbitAngle) * proj.orbitRadius;
        proj.y = player.y + Math.sin(proj.orbitAngle) * proj.orbitRadius;

        // Decrement hit cooldowns
        for (const enemyId in proj.hitCooldowns) {
            proj.hitCooldowns[enemyId] -= dt * 1000;
            if (proj.hitCooldowns[enemyId] <= 0) {
                delete proj.hitCooldowns[enemyId];
            }
        }

        // Check collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];

            // Skip if enemy is on cooldown for this Circlet
            const enemyId = enemies.indexOf(enemy);
            if (proj.hitCooldowns[enemyId]) continue;

            const dx = proj.x - enemy.x;
            const dy = proj.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < SCALED_TILE * 0.5) {
                // Apply damage
                enemy.health -= proj.damage;
                bloodSplatters.push({ x: enemy.x, y: enemy.y, frame: 0, frameTimer: 0 });
                // Add hit cooldown for this enemy
                proj.hitCooldowns[enemyId] = Circlet_HIT_COOLDOWN;

                if (enemy.health <= 0) {
                    score += enemy.maxHealth;
                    enemies.splice(j, 1);
                    checkForUpgrade();
                }
            }
        }
    }
}

function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        explosion.frameTimer += dt * 1000;

        if (explosion.frameTimer >= EXPLOSION_FRAME_DURATION) {
            explosion.frameTimer = 0;
            explosion.frame++;

            // Remove explosion when animation completes
            if (explosion.frame >= EXPLOSION_TOTAL_FRAMES) {
                explosions.splice(i, 1);
            }
        }
    }
}

function updateBlood(dt) {
    for (let i = bloodSplatters.length - 1; i >= 0; i--) {
        const blood = bloodSplatters[i];
        blood.frameTimer += dt * 1000;

        if (blood.frameTimer >= BLOOD_FRAME_DURATION) {
            blood.frameTimer = 0;
            blood.frame++;

            // Remove blood when animation completes
            if (blood.frame >= BLOOD_TOTAL_FRAMES) {
                bloodSplatters.splice(i, 1);
            }
        }
    }
}

function updateScrolls(dt) {
    for (const scroll of playerScrolls) {
        if (gameTime >= scroll.nextTriggerTime) {
            triggerScrollEffect(scroll);
            // Schedule next trigger
            const config = SCROLL_CONFIG[scroll.type];
            scroll.nextTriggerTime = gameTime + config.minInterval + Math.random() * (config.maxInterval - config.minInterval);
        }
    }
}

function triggerScrollEffect(scroll) {
    if (enemies.length === 0) return;

    // Set highlight for UI feedback
    scroll.highlightUntil = gameTime + 400;

    // Select nearest enemy to player
    let targetEnemy = enemies[0];
    let minDist = Infinity;
    for (const enemy of enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
            minDist = dist;
            targetEnemy = enemy;
        }
    }
    const config = SCROLL_CONFIG[scroll.type];

    switch (scroll.type) {
        case 'ScrollThunder':
            // Instant damage
            targetEnemy.health -= config.damage;
            bloodSplatters.push({ x: targetEnemy.x, y: targetEnemy.y, frame: 0, frameTimer: 0 });
            if (targetEnemy.health <= 0) {
                score += targetEnemy.maxHealth;
                const idx = enemies.indexOf(targetEnemy);
                if (idx !== -1) enemies.splice(idx, 1);
                checkForUpgrade();
            }
            break;

        case 'ScrollFire':
            // Apply burn status effect
            if (!targetEnemy.statusEffects) targetEnemy.statusEffects = {};
            targetEnemy.statusEffects.burn = {
                damage: config.burnDamage,
                duration: config.burnDuration,
                tickInterval: config.tickInterval,
                nextTickTime: gameTime + config.tickInterval
            };
            break;

        case 'ScrollIce':
            // Apply freeze status effect
            if (!targetEnemy.statusEffects) targetEnemy.statusEffects = {};
            targetEnemy.statusEffects.freeze = {
                duration: config.freezeDuration,
                endTime: gameTime + config.freezeDuration
            };
            break;
    }

    // Create visual effect
    const effectType = scroll.type.replace('Scroll', '');
    scrollEffects.push({
        x: targetEnemy.x,
        y: targetEnemy.y,
        type: effectType,
        frame: 0,
        frameTimer: 0,
        targetEnemy: targetEnemy
    });
}

function updateStatusEffects(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.statusEffects) continue;

        // Process burn
        if (enemy.statusEffects.burn) {
            const burn = enemy.statusEffects.burn;
            burn.duration -= dt * 1000;

            if (gameTime >= burn.nextTickTime) {
                enemy.health -= burn.damage;
                burn.nextTickTime = gameTime + burn.tickInterval;
                bloodSplatters.push({ x: enemy.x, y: enemy.y, frame: 0, frameTimer: 0 });

                if (enemy.health <= 0) {
                    score += enemy.maxHealth;
                    enemies.splice(i, 1);
                    checkForUpgrade();
                    continue;
                }
            }

            if (burn.duration <= 0) {
                delete enemy.statusEffects.burn;
            }
        }

        // Process freeze
        if (enemy.statusEffects.freeze) {
            if (gameTime >= enemy.statusEffects.freeze.endTime) {
                delete enemy.statusEffects.freeze;
            }
        }
    }
}

function updateScrollEffects(dt) {
    const EFFECT_FRAME_DURATION = 80; // ms per frame

    for (let i = scrollEffects.length - 1; i >= 0; i--) {
        const effect = scrollEffects[i];
        effect.frameTimer += dt * 1000;

        // Follow the target enemy if it still exists
        if (effect.targetEnemy && enemies.includes(effect.targetEnemy)) {
            effect.x = effect.targetEnemy.x;
            effect.y = effect.targetEnemy.y;
        }

        if (effect.frameTimer >= EFFECT_FRAME_DURATION) {
            effect.frameTimer = 0;
            effect.frame++;

            // Get frame count for this effect type
            const scrollType = 'Scroll' + effect.type;
            const config = SCROLL_CONFIG[scrollType];
            if (effect.frame >= config.effectFrames) {
                scrollEffects.splice(i, 1);
            }
        }
    }
}

function drawScrollEffects() {
    for (const effect of scrollEffects) {
        const scrollType = 'Scroll' + effect.type;
        const config = SCROLL_CONFIG[scrollType];
        const effectImage = images['Effect' + effect.type];
        if (!effectImage || !effectImage.complete || effectImage.naturalWidth === 0) continue;

        const frameWidth = config.frameWidth;
        const frameHeight = effectImage.naturalHeight;
        const effectSize = SCALED_TILE * 2;

        const screenX = effect.x - cameraX + canvas.width / 2 - effectSize / 2;
        const screenY = effect.y - cameraY + canvas.height / 2 - effectSize / 2;

        ctx.drawImage(
            effectImage,
            effect.frame * frameWidth, 0, frameWidth, frameHeight,
            screenX, screenY, effectSize, effectSize
        );
    }
}

function updateSpawnRate(dt) {
    gameTime += dt * 1000;
    swarmTimer += dt * 1000;

    // Get spawn interval from current phase
    const phase = getCurrentSpawnPhase();
    currentSpawnInterval = Math.max(MIN_SPAWN_INTERVAL, phase.spawnInterval);

    // Trigger swarm event periodically (first one delayed, then regular interval)
    if (!firstSwarmDone && gameTime >= SWARM_FIRST_DELAY) {
        firstSwarmDone = true;
        swarmTimer = 0;
        spawnSwarm();
    } else if (firstSwarmDone && swarmTimer >= SWARM_INTERVAL) {
        swarmTimer = 0;
        spawnSwarm();
    }
}

function restartGame() {
    gameState = 'playing';
    score = 0;
    gameTime = 0;
    swarmTimer = 0;
    firstSwarmDone = false;
    currentSpawnInterval = spawnPhasesData[0]?.spawnInterval || DEFAULT_SPAWN_INTERVAL;
    nextUpgradeIndex = 0;
    player.x = 0;
    player.y = 0;
    player.targetX = 0;
    player.targetY = 0;
    player.moving = false;
    player.frame = 0;
    playerFacingAngle = 0;
    cameraX = 0;
    cameraY = 0;
    enemies = [];
    projectiles = [];
    orbitingProjectiles = [];
    explosions = [];
    bloodSplatters = [];
    playerScrolls = [];
    scrollEffects = [];
    spawnTimer = 0;
    speedBoostTimer = 0;
    invincibilityTimer = 0;
    readyTimer = 0;

    // Reset to starting weapon
    playerWeapons = [{
        type: 'Kunai',
        level: 0,
        cooldownTimer: 0
    }];
}

// Main game loop
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Poll gamepad every frame (required by Gamepad API)
    pollGamepad();
    handleGamepadButtons();

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Countdown ready timer
    if (readyTimer > 0) {
        readyTimer -= dt;
    }

    if (gameState === 'playing' && readyTimer <= 0) {
        // Update spawn rate based on game time
        updateSpawnRate(dt);

        // Update spawn timer
        spawnTimer += dt * 1000;

        if (spawnTimer >= currentSpawnInterval) {
            spawnTimer = 0;
            spawnEnemy();
        }

        // Update weapons (independent cooldowns)
        updateWeapons(dt);

        // Update game objects
        updatePlayer(dt);
        if (speedBoostTimer > 0) {
            speedBoostTimer -= dt;
        }
        if (invincibilityTimer > 0) {
            invincibilityTimer -= dt;
        }
        updateEnemies(dt);
        updateProjectiles(dt);
        updateOrbitingProjectiles(dt);
        updateExplosions(dt);
        updateBlood(dt);
        updateScrolls(dt);
        updateStatusEffects(dt);
        updateScrollEffects(dt);
    }

    // Draw everything
    drawBackground();
    drawProjectiles();
    drawExplosions();
    drawBlood();
    drawScrollEffects();
    drawEnemies();
    drawPlayer();
    drawUI();

    if (gameState === 'gameover') {
        drawGameOver();
    } else if (gameState === 'upgrading') {
        drawUpgradeMenu();
    } else if (gameState === 'paused') {
        drawPauseMenu();
    } else if (readyTimer > 0) {
        drawReadyOverlay();
    }

    requestAnimationFrame(gameLoop);
}

// Start game
async function initGame() {
    await loadGameData();
    loadImages(() => {
        restartGame();
        requestAnimationFrame(gameLoop);
    });
}

initGame();
