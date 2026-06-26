# Cosmic Runner - Game Specification

## Concept & Vision
Cosmic Runner là một game platformer 2D lấy cảm hứng từ không gian vũ trụ. Người chơi điều khiển một phi hành gia nhỏ bé chạy qua các hành tinh, thu thập ngôi sao và tránh chướng ngại vật. Game mang phong cách retro-futuristic với màu sắc neon rực rỡ trên nền gradient vũ trụ.

## Design Language

### Aesthetic Direction
- Retro-futuristic space theme với neon glow effects
- Pixel-perfect character với smooth animations
- Parallax starfield backgrounds
- Glow và particle effects cho các collectibles

### Color Palette
- Primary: #00D4FF (Cyan neon)
- Secondary: #FF6B35 (Orange plasma)
- Accent: #FFE66D (Star yellow)
- Background: Gradient từ #0F0C29 qua #302B63 đến #24243E
- Platform: #8B5CF6 (Purple crystal)
- Text: #FFFFFF

### Typography
- Primary: 'Orbitron', sans-serif (headings, score)
- Secondary: 'Press Start 2P', cursive (game over, titles)

### Motion Philosophy
- Smooth physics-based movement với acceleration/deceleration
- Bounce animations cho collectibles
- Screen shake khi nhảy hoặc chết
- Particle burst khi thu thập items
- Floating animation cho platforms

## Layout & Structure

### Game States
1. **Start Screen**: Animated title, floating astronaut, "Press SPACE to Start"
2. **Playing**: Main gameplay với HUD (score, lives, level)
3. **Game Over**: Final score, high score, restart option
4. **Level Complete**: Celebration animation, next level transition

### HUD Elements
- Score (top-left)
- Lives (top-right, heart icons)
- Level indicator (top-center)

## Features & Interactions

### Core Mechanics
- Di chuyển trái/phải với A/D hoặc Arrow keys
- Nhảy với W hoặc Space
- Double jump ability (unlockable)
- Gravity physics với smooth landing
- Wall sliding (optional)

### Collectibles
- **Stars**: +100 points, yellow glow
- **Planets**: +500 points, purple aura
- **Power-ups**: Speed boost, shield, double jump

### Obstacles
- Moving spikes
- Falling platforms
- Enemy aliens
- Void gaps

### Levels
- Level 1: Tutorial - Basic platforms, few obstacles
- Level 2: Moving platforms introduced
- Level 3: Enemies appear
- Level 4: Complex combinations
- Level 5: Boss level (final)

### Scoring System
- Star collected: 100 points
- Planet collected: 500 points
- Enemy defeated: 300 points
- Level completed: 1000 bonus
- Time bonus: Based on completion speed

### Lives System
- Start with 3 lives
- Lose 1 life when hit by obstacle/enemy
- Gain extra life every 5000 points
- Game over at 0 lives

## Component Inventory

### Player Character
- Idle: Subtle breathing animation
- Running: Leg animation cycle
- Jumping: Arms up pose
- Falling: Arms spread pose
- Death: Explosion into particles

### Platforms
- Static: Solid purple crystal blocks
- Moving: Same with directional arrows
- Breakable: Cracks appear before breaking
- Bouncy: Spring animation on land

### UI Elements
- Buttons: Neon border glow, pulse on hover
- Score display: Counting animation
- Health bar: Heart pulse animation
- Level indicator: Slide-in animation

### Visual Effects
- Particle system for:
  - Star collection (yellow sparkles)
  - Jump dust
  - Death explosion
  - Landing impact
- Trail effect behind player
- Screen shake on events
- Flash effect on damage

## Technical Approach

### Technology
- HTML5 Canvas for rendering
- Vanilla JavaScript (no frameworks)
- RequestAnimationFrame for game loop
- Web Audio API for sound effects

### Architecture
- Game class (main controller)
- Player class (physics, animation)
- Platform class (collision, types)
- ParticleSystem class (visual effects)
- Level class (generation, progression)
- UI class (HUD, menus)

### Performance
- Object pooling for particles
- Efficient collision detection (AABB)
- Delta time for consistent physics
- Canvas layer optimization

### Storage
- LocalStorage for high score
- Level progress saving
