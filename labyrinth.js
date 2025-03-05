import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { initializeControls, setupMobileControls } from './controls.js';
import { generateLabyrinth } from './labyrinthGenerator.js';

let scene, camera, renderer;
let controls;
let raycaster;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let currentLabyrinthData = null;
let labyrinthMesh = null;
let wallTextures = [];
let floorTexture = null;
let ceilingTexture = null;
let isInitialized = false;
let isMobile = false;

// Collision detection
const WALL_SIZE = 4;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.5;

function init() {
  if (isInitialized) return;
  isInitialized = true;
  
  // Check if we're on mobile
  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.01);
  
  // Camera setup
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = PLAYER_HEIGHT;
  
  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  
  // Controls setup
  controls = new PointerLockControls(camera, document.body);
  
  // Basic lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  const pointLight = new THREE.PointLight(0xffffff, 1, 100);
  pointLight.position.set(0, 10, 0);
  pointLight.castShadow = true;
  scene.add(pointLight);
  
  // Raycaster for collision detection
  raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);
  
  // Keyboard controls
  const onKeyDown = function(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;
      case 'Space':
        if (canJump === true) velocity.y += 350;
        canJump = false;
        break;
    }
  };
  
  const onKeyUp = function(event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;
    }
  };
  
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  
  // Mobile controls if needed
  if (isMobile) {
    setupMobileControls(onMobileControlsUpdate);
  }
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Listen for labyrinth entry and exit events
  window.addEventListener('enter-labyrinth', onEnterLabyrinth);
  window.addEventListener('exit-labyrinth', onExitLabyrinth);
  
  initializeControls(controls);
  
  // Start animation loop
  animate();
}

function onMobileControlsUpdate(forward, backward, left, right) {
  moveForward = forward;
  moveBackward = backward;
  moveLeft = left;
  moveRight = right;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onEnterLabyrinth(event) {
  if (!isInitialized) init();
  
  const labyrinthData = event.detail;
  currentLabyrinthData = labyrinthData;
  
  // Enable controls
  controls.lock();
  
  // Generate labyrinth textures using AI
  generateLabyrinthTextures(labyrinthData)
    .then(() => {
      // Then generate the actual labyrinth
      return createLabyrinth(labyrinthData);
    })
    .then(() => {
      // Reset player position
      camera.position.set(WALL_SIZE * 1.5, PLAYER_HEIGHT, WALL_SIZE * 1.5);
      velocity.set(0, 0, 0);
    })
    .catch(error => {
      console.error("Error creating labyrinth:", error);
    });
}

function onExitLabyrinth() {
  controls.unlock();
  document.body.removeChild(renderer.domElement);
  
  // Clean up
  if (labyrinthMesh) {
    scene.remove(labyrinthMesh);
    labyrinthMesh.geometry.dispose();
    
    if (Array.isArray(labyrinthMesh.material)) {
      labyrinthMesh.material.forEach(m => m.dispose());
    } else {
      labyrinthMesh.material.dispose();
    }
    
    labyrinthMesh = null;
  }
  
  isInitialized = false;
  currentLabyrinthData = null;
}

async function generateLabyrinthTextures(labyrinthData) {
  // Generate wall textures for different biomes
  const description = labyrinthData.generatedDescription || labyrinthData.description;
  
  // Use LLM to extract biome information
  const completion = await websim.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a texture designer who creates descriptions for labyrinth textures.
        Given a labyrinth description, extract information about the biome and suggest 3 different wall textures,
        1 floor texture, and 1 ceiling texture. Be specific and descriptive but concise.
        Return the results as JSON.`
      },
      {
        role: "user",
        content: description
      }
    ],
    json: true
  });
  
  let textureInfo;
  try {
    textureInfo = JSON.parse(completion.content);
  } catch (e) {
    console.error("Failed to parse texture info JSON:", e);
    textureInfo = {
      wallTextures: [
        "stone brick wall with moss",
        "cracked ancient stone wall",
        "weathered stone wall with runes"
      ],
      floorTexture: "worn stone floor with small cracks",
      ceilingTexture: "dark stone ceiling with hanging roots"
    };
  }
  
  // Generate actual textures using AI
  wallTextures = [];
  for (let i = 0; i < textureInfo.wallTextures.length; i++) {
    const wallPrompt = `Seamless texture for a labyrinth wall: ${textureInfo.wallTextures[i]}. Top-down view, highly detailed, game asset texture.`;
    const wallResult = await websim.imageGen({
      prompt: wallPrompt,
      aspect_ratio: "1:1"
    });
    
    const texture = new THREE.TextureLoader().load(wallResult.url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    wallTextures.push(texture);
  }
  
  // Floor texture
  const floorPrompt = `Seamless texture for a labyrinth floor: ${textureInfo.floorTexture}. Top-down view, highly detailed, game asset texture.`;
  const floorResult = await websim.imageGen({
    prompt: floorPrompt,
    aspect_ratio: "1:1"
  });
  
  floorTexture = new THREE.TextureLoader().load(floorResult.url);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(10, 10);
  
  // Ceiling texture
  const ceilingPrompt = `Seamless texture for a labyrinth ceiling: ${textureInfo.ceilingTexture}. Bottom-up view, highly detailed, game asset texture.`;
  const ceilingResult = await websim.imageGen({
    prompt: ceilingPrompt,
    aspect_ratio: "1:1"
  });
  
  ceilingTexture = new THREE.TextureLoader().load(ceilingResult.url);
  ceilingTexture.wrapS = THREE.RepeatWrapping;
  ceilingTexture.wrapT = THREE.RepeatWrapping;
  ceilingTexture.repeat.set(10, 10);
}

function createLabyrinth(labyrinthData) {
  // Clean up existing labyrinth if any
  if (labyrinthMesh) {
    scene.remove(labyrinthMesh);
    labyrinthMesh.geometry.dispose();
    
    if (Array.isArray(labyrinthMesh.material)) {
      labyrinthMesh.material.forEach(m => m.dispose());
    } else {
      labyrinthMesh.material.dispose();
    }
  }
  
  // Get complexity settings
  let size = 10;
  switch(labyrinthData.complexity) {
    case 'easy': size = 10; break;
    case 'medium': size = 15; break;
    case 'hard': size = 20; break;
    case 'extreme': size = 30; break;
    default: size = 15;
  }
  
  // Generate maze layout
  const seedValue = labyrinthData.seed || labyrinthData.theme;
  const maze = generateLabyrinth(size, size, seedValue);
  
  // Create a group to hold all maze components
  labyrinthMesh = new THREE.Group();
  
  // Create floor
  const floorGeometry = new THREE.PlaneGeometry(size * WALL_SIZE, size * WALL_SIZE);
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    map: floorTexture,
    roughness: 0.8,
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(size * WALL_SIZE / 2, 0, size * WALL_SIZE / 2);
  floor.receiveShadow = true;
  labyrinthMesh.add(floor);
  
  // Create ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(size * WALL_SIZE, size * WALL_SIZE);
  const ceilingMaterial = new THREE.MeshStandardMaterial({ 
    map: ceilingTexture,
    roughness: 0.7,
    metalness: 0.3
  });
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(size * WALL_SIZE / 2, WALL_SIZE, size * WALL_SIZE / 2);
  ceiling.receiveShadow = true;
  labyrinthMesh.add(ceiling);
  
  // Create walls
  const wallGeometry = new THREE.BoxGeometry(WALL_SIZE, WALL_SIZE, WALL_SIZE);
  
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (maze[z][x] === 1) {
        // Choose a random wall texture
        const textureIndex = Math.floor(Math.random() * wallTextures.length);
        const wallMaterial = new THREE.MeshStandardMaterial({ 
          map: wallTextures[textureIndex],
          roughness: 0.7,
          metalness: 0.2
        });
        
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(x * WALL_SIZE + WALL_SIZE/2, WALL_SIZE/2, z * WALL_SIZE + WALL_SIZE/2);
        wall.castShadow = true;
        wall.receiveShadow = true;
        labyrinthMesh.add(wall);
      }
    }
  }
  
  // Add some lights in the maze
  for (let i = 0; i < size / 3; i++) {
    let x, z;
    do {
      x = Math.floor(Math.random() * size);
      z = Math.floor(Math.random() * size);
    } while (maze[z][x] === 1);
    
    const light = new THREE.PointLight(0xffaa00, 1, WALL_SIZE * 3);
    light.position.set(x * WALL_SIZE + WALL_SIZE/2, WALL_SIZE/2, z * WALL_SIZE + WALL_SIZE/2);
    labyrinthMesh.add(light);
    
    // Add a small glowing sphere as a light source
    const lightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const lightMesh = new THREE.Mesh(lightGeometry, lightMaterial);
    lightMesh.position.copy(light.position);
    labyrinthMesh.add(lightMesh);
  }
  
  scene.add(labyrinthMesh);
  
  return Promise.resolve();
}

function detectCollisions() {
  if (!labyrinthMesh) return false;
  
  // Cast rays in all directions to detect walls
  const rayDirections = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 1).normalize(),
    new THREE.Vector3(-1, 0, 1).normalize(),
    new THREE.Vector3(1, 0, -1).normalize(),
    new THREE.Vector3(-1, 0, -1).normalize()
  ];
  
  const position = camera.position.clone();
  
  // Check collisions with walls
  for (const dir of rayDirections) {
    raycaster.set(position, dir);
    const intersects = raycaster.intersectObjects(labyrinthMesh.children, false);
    
    for (let i = 0; i < intersects.length; i++) {
      // If we're too close to a wall
      if (intersects[i].distance < PLAYER_RADIUS) {
        return intersects[i];
      }
    }
  }
  
  return false;
}

function animate() {
  requestAnimationFrame(animate);
  
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  // Only update physics if pointer is locked (player is in game)
  if (controls.isLocked && labyrinthMesh) {
    // Store original position to revert on collision
    const originalPosition = camera.position.clone();
    
    // Apply gravity and update velocity
    velocity.y -= 9.8 * 10.0 * delta;
    
    // Apply movement
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();
    
    const speed = 5.0;
    
    if (moveForward || moveBackward) velocity.z = -direction.z * speed;
    else velocity.z = 0;
    
    if (moveLeft || moveRight) velocity.x = -direction.x * speed;
    else velocity.x = 0;
    
    controls.moveRight(velocity.x * delta);
    controls.moveForward(velocity.z * delta);
    
    // Apply gravity
    camera.position.y += velocity.y * delta;
    
    // Ground check
    if (camera.position.y < PLAYER_HEIGHT) {
      velocity.y = 0;
      camera.position.y = PLAYER_HEIGHT;
      canJump = true;
    }
    
    // Collision detection - revert position if colliding
    const collision = detectCollisions();
    if (collision) {
      // Revert to previous position if there's a collision
      camera.position.copy(originalPosition);
    }
  }
  
  prevTime = time;
  
  // Render
  renderer.render(scene, camera);
}

export { init };

