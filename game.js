// Game Modules
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint,
    Vector = Matter.Vector,
    Body = Matter.Body;

// Game State
let engine, render, runner;
let score = 0;
let timeLeft = 60;
let gameInterval;
let timerInterval;
let isPlaying = false;
let currentChain = []; // Array of bodies
let lastConnectedBody = null;
let particles = []; // Array for visual effects
let comboCount = 0; // Track successful chains
let comboTimer = null; // Timer for combo streak
let nextSpawnIsApple = false; // Flag to spawn apple
let nextSpawnIsBig = false; // Flag to spawn big tsum

// Configuration
const WALL_THICKNESS = 60;
const TSUM_RADIUS = 30; // Size of tsums
const SPAWN_LIMIT = 45; // Max tsums on screen (adjusted for performance/size)
const ASSETS = [
    { type: 'chorori', texture: 'assets/chorori.png', color: '#ffb7b2' },
    { type: 'chamaru', texture: 'assets/chamaru.png', color: '#ffcc80' },
    { type: 'mokorena', texture: 'assets/mokorena.png', color: '#e1bee7' },
    { type: 'marisuke', texture: 'assets/marisuke.png', color: '#b2dfdb' }
];
const APPLE_ASSET = { type: 'apple', texture: 'assets/apple.png' };

// Elements
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const finalScoreEl = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const canvas = document.getElementById('world');
const comboDisplayEl = document.getElementById('combo-display');

// Initialize Matter.js
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Sound Effects (Synthesized)
function playStartSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Arpeggio
    [440, 554, 659, 880].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
    });
}

function playTouchSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    // "Puyo" sound - rapid pitch drop
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
}

function playClearSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // "Chararan" - MORE INTENSE & SPARKLY!
    // Two layers: 1. Main melody run, 2. High sparkle shimmering

    // Layer 1: Fast Major 7th Run (2 octaves)
    const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    freqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        osc.type = 'triangle';
        // Faster, punchier
        gain.gain.setValueAtTime(0.1, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.3);
    });

    // Layer 2: High frequency sparkles (random pentatonic)
    for (let i = 0; i < 5; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        // High random notes
        osc.frequency.value = 2000 + Math.random() * 2000;
        osc.type = 'sine';
        const delay = Math.random() * 0.2;
        gain.gain.setValueAtTime(0.05, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.2);
    }
}

function playComboSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    // "Kira" - high pitch, bell-like
    osc.frequency.setValueAtTime(1200 + Math.random() * 500, now);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
}

function playExplosionSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const buffer = getNoiseBuffer();

    // Boom
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 1.0); // Sweep down

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(now);
    source.stop(now + 1.0);
}

function playWindSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const buffer = getNoiseBuffer();

    // Whoosh
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.3); // Sweep up

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(now);
    source.stop(now + 0.4);
}

function playFinishJingle() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    // Simple Fanfare
    [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        // Last note longer
        const duration = (i === 5) ? 1.0 : 0.2;
        const startT = now + i * 0.15;

        osc.type = 'square';
        gain.gain.setValueAtTime(0.1, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startT);
        osc.stop(startT + duration);
    });
}

function init() {
    let noiseBuffer = null;
    function getNoiseBuffer() {
        if (!audioCtx) return null;
        if (!noiseBuffer) {
            const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
            noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        }
        return noiseBuffer;
    }

    function playCrackerSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const buffer = getNoiseBuffer();
        if (!buffer) return;

        // Pop sound
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = audioCtx.createGain();
        // Lowpass filter to make it sound like an explosion/pop
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        source.start(now);
        source.stop(now + 0.3);
    }

    function playApplauseSound() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const buffer = getNoiseBuffer();
        if (!buffer) return;

        // Modest applause: multiple small claps
        for (let i = 0; i < 15; i++) {
            const start = now + Math.random() * 1.5; // Spread over 1.5s
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            filter.type = 'bandpass';
            filter.frequency.value = 800 + Math.random() * 400; // Varying clap tones

            // Low volume per clap
            gain.gain.setValueAtTime(0.05, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            source.start(start);
            source.stop(start + 0.1);
        }
    }

    function init() {
        // Create engine
        engine = Engine.create();

        // Create renderer
        const container = document.getElementById('game-container');
        const canvasEl = document.getElementById('world');
        // Ensure layout is computed (force reflow not strictly needed but good to be safe if dynamic)
        const width = canvasEl.clientWidth;
        const height = canvasEl.clientHeight;

        render = Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width: width,
                height: height,
                background: 'transparent',
                wireframes: false, // Important for textures
                showAngleIndicator: false
            }
        });

        // Create walls
        const ground = Bodies.rectangle(width / 2, height + WALL_THICKNESS / 2 - 10, width, WALL_THICKNESS, { isStatic: true, render: { visible: false } });
        const leftWall = Bodies.rectangle(0 - WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height, { isStatic: true, render: { visible: false } });
        const rightWall = Bodies.rectangle(width + WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height, { isStatic: true, render: { visible: false } });

        Composite.add(engine.world, [ground, leftWall, rightWall]);

        // Mouse control
        const mouse = Mouse.create(render.canvas);
        // Disable default constraint (we will handle interaction manually for chaining)
        // Actually we don't want to drag bodies, we want to connect them.
        // But we need mouse position.

        // Remove the default mouse constraint if we don't want physics dragging
        // But maybe physics dragging is fun? Tsum Tsum generally doesn't let you drag bodies, just connect.
        // So we'll just track mouse.
        render.mouse = mouse;

        // Events
        Events.on(render, 'afterRender', () => {
            drawChain();
            drawEffects();
        });

        // Input handling
        canvas.addEventListener('mousedown', handleInputStart);
        canvas.addEventListener('touchstart', handleInputStart, { passive: false });

        canvas.addEventListener('mousemove', handleInputMove);
        canvas.addEventListener('touchmove', handleInputMove, { passive: false });

        canvas.addEventListener('mouseup', handleInputEnd);
        canvas.addEventListener('touchend', handleInputEnd);

        // Initial Runner
        runner = Runner.create();
        Runner.run(runner, engine);
        Render.run(render);

        // Start Loop for spawning
        setInterval(gameLoop, 100);
    }

    function startGame() {
        initAudio(); // Initialize audio context on first user interaction
        playStartSound();

        // Reset state
        score = 0;
        timeLeft = 60;
        updateUI();
        isPlaying = true;

        // Clear existing tsums
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        Composite.remove(engine.world, bodies);

        // Start Timer
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;

            const container = document.getElementById('game-container');
            if (timeLeft <= 5 && timeLeft > 3) {
                container.classList.add('urgent-slow');
            } else if (timeLeft <= 3) {
                container.classList.remove('urgent-slow');
                container.classList.add('urgent-fast');
            }

            if (timeLeft <= 0) {
                endGame();
            }
            updateUI();
        }, 1000);

        // Reset urgency
        document.getElementById('game-container').classList.remove('urgent-slow');
        document.getElementById('game-container').classList.remove('urgent-fast');

        // Hide screens
        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
    }

    function endGame() {
        isPlaying = false;
        clearInterval(timerInterval);

        // Clear urgency effects immediately
        const container = document.getElementById('game-container');
        container.classList.remove('urgent-slow');
        container.classList.remove('urgent-fast');

        // Hide combo Text
        comboDisplayEl.classList.add('hidden');
        if (comboTimer) clearTimeout(comboTimer);
        comboCount = 0;

        finalScoreEl.innerText = "0"; // Start at 0
        resultScreen.classList.remove('hidden');
        resultScreen.style.display = 'flex'; // Ensure flex layout

        animateScore(score);

        // Celebration Effects
        playCrackerSound();
        playApplauseSound();
        playFinishJingle();

        // Visual Confetti from bottom corners
        const width = render.options.width;
        const height = render.options.height;
        spawnConfettiShower(0, height);
        spawnConfettiShower(width, height);
    }

    function animateScore(target) {
        // Reset boing
        finalScoreEl.classList.remove('boing');

        let current = 0;
        const increment = Math.ceil(target / 60); // Animate over ~1 second (60 frames)

        function step() {
            current += increment;
            if (current >= target) {
                current = target;
                finalScoreEl.innerText = current;
                // Boing animation
                finalScoreEl.classList.add('boing');
            } else {
                finalScoreEl.innerText = current;
                requestAnimationFrame(step);
            }
        }
        step();
    }

    function gameLoop() {
        // Always update particles for visual continuity (crackers etc.)
        updateParticles();

        if (!isPlaying) return;

        // Spawn Tsums if needed
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        if (bodies.length < SPAWN_LIMIT) {
            spawnTsum();
        }
    }

    function spawnTsum() {
        const width = render.options.width;
        const randomX = Math.random() * (width - 100) + 50;

        // Check flags
        let item;
        let isApple = false;
        let isBig = false;

        if (nextSpawnIsApple) {
            item = APPLE_ASSET;
            isApple = true;
            nextSpawnIsApple = false;
        } else if (nextSpawnIsBig) {
            item = ASSETS[Math.floor(Math.random() * ASSETS.length)];
            isBig = true;
            nextSpawnIsBig = false;
        } else {
            item = ASSETS[Math.floor(Math.random() * ASSETS.length)];
        }

        // Scale Logic
        // Normal: Radius 30, Scale 0.07 (approx)
        // Big: Radius 60, Scale 0.14
        const radius = isBig ? TSUM_RADIUS * 2 : TSUM_RADIUS;
        const scaleBase = isApple ? 0.06 : 0.07;
        const scale = isBig ? scaleBase * 2 : scaleBase;

        const body = Bodies.circle(randomX, -50, radius, {
            restitution: 0.5,
            friction: 0.1,
            label: item.type,
            isBig: isBig, // Custom property
            render: {
                sprite: {
                    texture: item.texture,
                    xScale: scale,
                    yScale: scale
                }
            }
        });

        Composite.add(engine.world, body);
    }

    // Interaction Logic
    function getBodyAt(x, y) {
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        // Simple distance check is often better than Query.point for circles
        for (let b of bodies) {
            // Use b.circleRadius if available, otherwise default to TSUM_RADIUS
            const currentRadius = b.circleRadius || TSUM_RADIUS;
            if (Vector.magnitude(Vector.sub(b.position, { x, y })) < currentRadius) {
                return b;
            }
        }
        return null;
    }

    function handleInputStart(e) {
        if (!isPlaying) return;
        e.preventDefault();
        const pos = getMousePos(e);
        const body = getBodyAt(pos.x, pos.y);

        if (body) {
            // Check for Apple
            if (body.label === 'apple') {
                triggerExplosion(body);
                playExplosionSound(); // Play sound immediately on apple click
                return;
            }

            // Touch Feedback: Pulse
            pulseBody(body);

            currentChain = [body];
            lastConnectedBody = body;
        }
    }

    function handleInputMove(e) {
        if (!isPlaying || currentChain.length === 0) return;
        e.preventDefault();
        const pos = getMousePos(e);
        const body = getBodyAt(pos.x, pos.y);

        if (body && body !== lastConnectedBody) {
            // Check if same type
            if (body.label === lastConnectedBody.label) {
                // Check distance (must be adjacent)
                // Use the larger radius for distance check if one is big
                const r1 = lastConnectedBody.circleRadius || TSUM_RADIUS;
                const r2 = body.circleRadius || TSUM_RADIUS;
                const maxRadius = Math.max(r1, r2);

                const dist = Vector.magnitude(Vector.sub(body.position, lastConnectedBody.position));
                if (dist < maxRadius * 2.5) { // Allow some slack
                    // Check if already in chain (backtracking?)
                    const index = currentChain.indexOf(body);
                    if (index === -1) {
                        // Add
                        currentChain.push(body);
                        lastConnectedBody = body;

                        // Touch Feedback: Pulse every newly connected body
                        pulseBody(body);

                        // Play sound?
                    } else if (index === currentChain.length - 2) {
                        // Backtrack
                        currentChain.pop();
                        lastConnectedBody = currentChain[currentChain.length - 1];
                    }
                }
            }
        }
    }

    function handleInputEnd(e) {
        if (!isPlaying) return;

        if (currentChain.length >= 3) {
            const length = currentChain.length;

            // Calculate score logic first (score is added immediately for simplicity or can be delayed)
            // Let's add score at the end of the chain removal? 
            // Or just add it now but visualize removal sequentially.

            let scoreToAdd = 0;
            currentChain.forEach(b => {
                scoreToAdd += (b.isBig ? 300 : 100);
            });
            const chainBonus = (length > 4 ? (length - 4) * 500 : 0);
            const totalScoreAdd = scoreToAdd + chainBonus;
            score += totalScoreAdd;

            playClearSound(); // Play main sound

            // Sequential Removal
            const chainToClear = [...currentChain]; // Copy
            currentChain = []; // Clear immediately to prevent interaction
            lastConnectedBody = null;

            // Disable input or just ignore? currentChain is empty so user needs to start fresh.
            // We iterate and remove items one by one.
            chainToClear.forEach((b, i) => {
                setTimeout(() => {
                    // Check if body still exists (world might have reset)
                    if (Composite.get(engine.world, b.id, b.type)) {
                        Composite.remove(engine.world, b);

                        // Particle for this specific body
                        // More particles for longer chains
                        const pCount = 5 + Math.floor(length / 2);
                        spawnParticles(b.position.x, b.position.y, pCount, getAssetColor(b.label));

                        // Small pop sound? We rely on main clear sound as it is cleaner.
                    }
                }, i * 50); // Fast sequence
            });

            // Flashy effect for long chains
            if (length >= 7) {
                // Global confetti or screen shake could go here
            }

            // Combo Logic
            // Reset existing timer
            if (comboTimer) clearTimeout(comboTimer);

            comboCount++;
            showComboText(comboCount);

            // Set new timer for 3 seconds
            comboTimer = setTimeout(() => {
                comboCount = 0;
                comboDisplayEl.classList.add('hidden');
            }, 3000);

            if (comboCount > 0) {
                if (comboCount % 10 === 0) {
                    nextSpawnIsApple = true;
                } else if (comboCount % 5 === 0) {
                    nextSpawnIsBig = true;
                }
            }

            updateUI();
        } else {
            // Cancel chain
            currentChain = [];
            lastConnectedBody = null;
        }
    }

    function shuffleBodies() {
        if (!isPlaying) return;
        playWindSound(); // Sound effect
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        bodies.forEach(b => {
            // Apply upward and random sideways force
            Body.applyForce(b, b.position, {
                x: (Math.random() - 0.5) * 0.05 * b.mass,
                y: -0.05 * b.mass // Upward kick
            });
        });

        // Animate button spin? handled by CSS active state for now
    }

    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function drawChain() {
        if (currentChain.length < 2) return;

        const ctx = render.context;
        ctx.beginPath();
        ctx.moveTo(currentChain[0].position.x, currentChain[0].position.y);

        for (let i = 1; i < currentChain.length; i++) {
            ctx.lineTo(currentChain[i].position.x, currentChain[i].position.y);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Add Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'white';

        ctx.stroke();

        // Inner line for color
        ctx.beginPath();
        ctx.moveTo(currentChain[0].position.x, currentChain[0].position.y);
        for (let i = 1; i < currentChain.length; i++) {
            ctx.lineTo(currentChain[i].position.x, currentChain[i].position.y);
        }
        ctx.strokeStyle = '#ffcc80'; // Accent color
        ctx.lineWidth = 5;
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw Chain Count Text
        // Draw near the last connected body (which is where the user's finger likely is)
        const lastBody = currentChain[currentChain.length - 1];
        ctx.save();
        ctx.translate(lastBody.position.x, lastBody.position.y);
        // Draw offset to top-right
        ctx.fillStyle = '#ff7043';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.font = 'bold 24px "Mochiy Pop One", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = currentChain.length + "";
        const offsetX = 30;
        const offsetY = -30;

        ctx.strokeText(text, offsetX, offsetY);
        ctx.fillText(text, offsetX, offsetY);
        ctx.restore();
    }

    function getAssetColor(type) {
        const asset = ASSETS.find(a => a.type === type);
        return asset ? asset.color : '#ffffff';
    }

    function triggerExplosion(appleBody) {
        // Visuals: Rainbow Explosion
        playExplosionSound(); // Boom!
        spawnRainbowExplosion(appleBody.position.x, appleBody.position.y);

        // Logic: Remove surrounding bodies
        const bodies = Composite.allBodies(engine.world).filter(b => !b.isStatic);
        const radius = 200; // Explosion radius
        const bodiesToRemove = bodies.filter(b => {
            const dist = Vector.magnitude(Vector.sub(b.position, appleBody.position));
            return dist < radius;
        });

        // Spawn small particles for each removed body to show they are destroyed
        bodiesToRemove.forEach(b => {
            // If it's another apple, maybe trigger another explosion? (Optional, prevent infinite loop for now)
            if (b !== appleBody) {
                spawnParticles(b.position.x, b.position.y, 5, getAssetColor(b.label));
            }
        });

        // Score
        const count = bodiesToRemove.length;
        score += count * 200; // Bonus points for apple clear
        updateUI();

        Composite.remove(engine.world, bodiesToRemove);
    }

    // Particle System
    function spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: color,
                size: Math.random() * 5 + 2
            });
        }
    }

    function spawnRainbowExplosion(x, y) {
        // 1. Center Flash (Big Boom)
        particles.push({
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            life: 1.0,
            color: 'white',
            size: 150, // Big radius
            type: 'flash',
            maxLife: 1.0
        });

        // 2. Concentrated Sparkles
        for (let i = 0; i < 40; i++) {
            const hue = Math.floor(Math.random() * 360);
            // Slower speed for more "dense" feel near center, but some fast ones
            const speed = Math.random() * 15 + 5;
            const angle = Math.random() * Math.PI * 2;

            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8 + Math.random() * 0.4,
                color: `hsl(${hue}, 100%, 60%)`,
                size: Math.random() * 8 + 5,
                type: 'sparkle'
            });
        }
    }

    function spawnConfettiShower(x, y) {
        const isLeft = x < render.options.width / 2;
        // Shower of confetti
        for (let i = 0; i < 40; i++) {
            // Aim towards center
            const angle = isLeft ? -Math.PI / 4 : -Math.PI * 3 / 4;
            const spread = (Math.random() - 0.5) * 1.0; // Spread angle
            const speed = Math.random() * 15 + 10; // High speed up

            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed + (Math.random() * -5), // Extra Up
                life: 2.0 + Math.random(),
                color: `hsl(${Math.random() * 360}, 100%, 50%)`,
                size: Math.random() * 6 + 4,
                type: 'confetti',
                rotation: Math.random() * Math.PI,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            if (p.type === 'flash') {
                p.life -= 0.1; // Fade fast
            } else if (p.type === 'confetti') {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02; // Slow fade
                p.vy += 0.3; // Gravity
                p.vx *= 0.95; // Air resistance
                p.rotation += p.rotationSpeed;
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.06;
                p.vy += 0.5;
            }

            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function drawEffects() {
        const ctx = render.context;

        // Highlight Same Characters
        if (currentChain.length > 0) {
            const targetType = currentChain[0].label;
            const bodies = Composite.allBodies(engine.world);

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 4;
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 10;

            bodies.forEach(b => {
                if (b.label === targetType && !currentChain.includes(b) && !b.isStatic) {
                    ctx.beginPath();
                    ctx.arc(b.position.x, b.position.y, b.circleRadius || TSUM_RADIUS, 0, Math.PI * 2);
                    ctx.stroke();

                    // Slight white overlay
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fill();
                }
            });
            ctx.restore();
        }

        // Glow effect for particles
        ctx.globalCompositeOperation = 'lighter';

        for (const p of particles) {
            if (p.type === 'flash') {
                const alpha = Math.max(0, p.life);
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.5})`);
                gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'confetti') {
                // Draw rect for confetti
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();

                // Extra shine
                if (p.type === 'sparkle') {
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * p.life * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    function updateUI() {
        scoreEl.innerText = score;
        timerEl.innerText = timeLeft;
    }

    function showComboText(count) {
        if (count < 2) return;
        comboDisplayEl.innerText = count + " コンボ";

        playComboSound(); // Combo Sound

        // Dynamic Font Size Scaling - Smaller Range
        // Start at 2.5rem.
        // Cap growth at 10 combos. Max 3.5rem? (Diff 1.0)
        // Growth: 0.1rem per combo.
        const growthSteps = Math.min(Math.max(0, count - 2), 8);
        const fontSize = 2.5 + (growthSteps * 0.15); // Max ~ 3.7rem

        comboDisplayEl.style.fontSize = `${fontSize}rem`;

        comboDisplayEl.classList.remove('hidden');

        // Reset animation
        comboDisplayEl.style.animation = 'none';
        comboDisplayEl.offsetHeight; /* trigger reflow */
        comboDisplayEl.style.animation = null;

        // We handle hiding via logic timer now, so no auto-hide timeout here strictly needed unless visual sync issues
        // But keeping it consistent with the logic timer is good. 
        // Logic timer hides it at 3s.
    }

    function pulseBody(body) {
        playTouchSound(); // Play 'Puyo' sound
        const originalScale = body.render.sprite.xScale;
        // Don't double pulse if already pulsing (simple check)
        // Actually just overwrite is fine for simple tween

        // We can't easily tween in Matter.js render without a custom updator or just a timeout hack
        // Timeout hack is fine for this style
        body.render.sprite.xScale = originalScale * 1.2;
        body.render.sprite.yScale = originalScale * 1.2;
        setTimeout(() => {
            body.render.sprite.xScale = originalScale;
            body.render.sprite.yScale = originalScale;
        }, 100);
    }

    // Event Listeners
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    shuffleBtn.addEventListener('click', shuffleBodies);

    // Init on load
    window.onload = init;
