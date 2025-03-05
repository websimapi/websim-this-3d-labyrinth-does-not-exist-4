// Mobile controls and input handling

// Variables for touch controls
let leftJoystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
let rightJoystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let lookDeltaX = 0;
let lookDeltaY = 0;
let controlsCallback = null;

// Initialize controls for desktop
export function initializeControls(controls) {
  // Set up click handler to lock pointer
  document.addEventListener('click', function() {
    if (controls && !controls.isLocked) {
      controls.lock();
    }
  });
  
  // Handle unlock
  controls.addEventListener('unlock', function() {
    // Any cleanup needed when controls are unlocked
  });
}

// Set up mobile controls
export function setupMobileControls(callback) {
  controlsCallback = callback;
  
  // Create mobile controls UI
  createMobileControlsUI();
  
  // Add touch event listeners
  const leftJoystickElement = document.getElementById('leftJoystick');
  const rightJoystickElement = document.getElementById('rightJoystick');
  
  if (leftJoystickElement) {
    setupJoystick(leftJoystickElement, 'left');
  }
  
  if (rightJoystickElement) {
    setupJoystick(rightJoystickElement, 'right');
  }
  
  // Prevent default touch actions
  document.addEventListener('touchmove', function(e) {
    if (e.target.classList.contains('joystick-container') || 
        e.target.classList.contains('joystick-knob')) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // Update loop for controls
  updateMobileControls();
}

function createMobileControlsUI() {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'mobile-controls';
  controlsContainer.id = 'mobileControls';
  
  // Left joystick (movement)
  const leftJoystick = document.createElement('div');
  leftJoystick.className = 'joystick-container';
  leftJoystick.id = 'leftJoystick';
  
  const leftKnob = document.createElement('div');
  leftKnob.className = 'joystick-knob';
  leftKnob.id = 'leftKnob';
  
  leftJoystick.appendChild(leftKnob);
  
  // Right joystick (looking)
  const rightJoystick = document.createElement('div');
  rightJoystick.className = 'joystick-container';
  rightJoystick.id = 'rightJoystick';
  
  const rightKnob = document.createElement('div');
  rightKnob.className = 'joystick-knob';
  rightKnob.id = 'rightKnob';
  
  rightJoystick.appendChild(rightKnob);
  
  // Append to container
  controlsContainer.appendChild(leftJoystick);
  controlsContainer.appendChild(rightJoystick);
  
  // Append to body
  document.body.appendChild(controlsContainer);
}

function setupJoystick(joystickElement, type) {
  const knobElement = joystickElement.querySelector('.joystick-knob');
  const joystick = type === 'left' ? leftJoystick : rightJoystick;
  
  // Touch start
  joystickElement.addEventListener('touchstart', function(e) {
    const touch = e.touches[0];
    const rect = joystickElement.getBoundingClientRect();
    
    joystick.active = true;
    joystick.startX = touch.clientX;
    joystick.startY = touch.clientY;
    joystick.currentX = touch.clientX;
    joystick.currentY = touch.clientY;
    
    // Initial position
    updateJoystickPosition(knobElement, joystick);
    
    e.preventDefault();
  }, { passive: false });
  
  // Touch move
  joystickElement.addEventListener('touchmove', function(e) {
    if (!joystick.active) return;
    
    const touch = e.touches[0];
    joystick.currentX = touch.clientX;
    joystick.currentY = touch.clientY;
    
    updateJoystickPosition(knobElement, joystick);
    
    e.preventDefault();
  }, { passive: false });
  
  // Touch end
  joystickElement.addEventListener('touchend', function(e) {
    joystick.active = false;
    
    // Reset knob position
    knobElement.style.transform = 'translate(-50%, -50%)';
    
    // Reset movement if left joystick
    if (type === 'left') {
      moveForward = false;
      moveBackward = false;
      moveLeft = false;
      moveRight = false;
      
      if (controlsCallback) {
        controlsCallback(false, false, false, false);
      }
    }
    
    e.preventDefault();
  }, { passive: false });
  
  // Touch cancel
  joystickElement.addEventListener('touchcancel', function(e) {
    joystick.active = false;
    
    // Reset knob position
    knobElement.style.transform = 'translate(-50%, -50%)';
    
    // Reset movement if left joystick
    if (type === 'left') {
      moveForward = false;
      moveBackward = false;
      moveLeft = false;
      moveRight = false;
      
      if (controlsCallback) {
        controlsCallback(false, false, false, false);
      }
    }
    
    e.preventDefault();
  }, { passive: false });
}

function updateJoystickPosition(knobElement, joystick) {
  // Calculate distance from center
  const dx = joystick.currentX - joystick.startX;
  const dy = joystick.currentY - joystick.startY;
  
  // Calculate distance
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Maximum distance the knob can move (radius of the joystick)
  const maxDistance = 50;
  
  // Normalize if distance is greater than max
  let normDx = dx;
  let normDy = dy;
  
  if (distance > maxDistance) {
    const ratio = maxDistance / distance;
    normDx *= ratio;
    normDy *= ratio;
  }
  
  // Update knob position
  knobElement.style.transform = `translate(calc(-50% + ${normDx}px), calc(-50% + ${normDy}px))`;
  
  // Determine movement direction for left joystick
  if (joystick === leftJoystick) {
    // Reset movement
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    
    // Threshold for movement activation
    const threshold = 15;
    
    // Determine movement based on joystick position
    if (dy < -threshold) moveForward = true;
    if (dy > threshold) moveBackward = true;
    if (dx < -threshold) moveLeft = true;
    if (dx > threshold) moveRight = true;
    
    // Update callback
    if (controlsCallback) {
      controlsCallback(moveForward, moveBackward, moveLeft, moveRight);
    }
  }
  
  // Determine look direction for right joystick
  if (joystick === rightJoystick) {
    // Calculate look deltas
    lookDeltaX = dx * 0.1;
    lookDeltaY = dy * 0.1;
  }
}

function updateMobileControls() {
  requestAnimationFrame(updateMobileControls);
  
  // Apply camera rotation from right joystick if active
  if (rightJoystick.active) {
    // This needs to be handled in the main game loop
    // We're just calculating the deltas here
  }
}

// Export look deltas for camera control
export function getLookDeltas() {
  const deltas = { x: lookDeltaX, y: lookDeltaY };
  // Reset deltas after reading
  lookDeltaX = 0;
  lookDeltaY = 0;
  return deltas;
}

