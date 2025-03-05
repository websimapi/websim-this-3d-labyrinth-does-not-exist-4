// This file contains functions to generate random labyrinths

// Seeded random number generator
function seededRandom(seed) {
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Simple LCG (Linear Congruential Generator)
  let state = hash;
  return function() {
    state = (1664525 * state + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Generate a labyrinth using a seeded random number generator
export function generateLabyrinth(width, height, seed) {
  // Initialize the random function with the seed
  const random = seededRandom(seed);
  
  // Initialize the grid with all walls
  let grid = Array(height).fill().map(() => Array(width).fill(1));
  
  // Starting at a random point
  let startX = Math.floor(random() * (width - 2)) + 1;
  let startY = Math.floor(random() * (height - 2)) + 1;
  
  // Set the starting cell as a path
  grid[startY][startX] = 0;
  
  // Use recursive backtracking to generate the maze
  const stack = [[startX, startY]];
  const directions = [
    [0, -2], // up
    [2, 0],  // right
    [0, 2],  // down
    [-2, 0]  // left
  ];
  
  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    
    // Shuffle directions randomly
    const shuffledDirections = [...directions].sort(() => random() - 0.5);
    
    let moved = false;
    
    for (const [dx, dy] of shuffledDirections) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && grid[ny][nx] === 1) {
        // Remove the wall between the current cell and the next cell
        grid[y + dy/2][x + dx/2] = 0;
        // Mark the next cell as a path
        grid[ny][nx] = 0;
        // Add the next cell to the stack
        stack.push([nx, ny]);
        moved = true;
        break;
      }
    }
    
    if (!moved) {
      // Backtrack if no valid direction is found
      stack.pop();
    }
  }
  
  // Ensure entrance and exit
  grid[0][1] = 0; // Entrance
  grid[height-1][width-2] = 0; // Exit
  
  // Add some random paths for complexity
  const paths = Math.floor(width * height * 0.05);
  for (let i = 0; i < paths; i++) {
    const x = Math.floor(random() * (width - 2)) + 1;
    const y = Math.floor(random() * (height - 2)) + 1;
    
    if (grid[y][x] === 1) {
      grid[y][x] = 0;
    }
  }
  
  return grid;
}

// Function to create an infinite labyrinth by generating new sections as player moves
export function generateInfiniteLabyrinth(currentX, currentY, sectionSize, seed) {
  // Determine which section the player is in
  const sectionX = Math.floor(currentX / sectionSize);
  const sectionY = Math.floor(currentY / sectionSize);
  
  // Generate seeds for adjacent sections
  const seeds = {
    current: `${seed}_${sectionX}_${sectionY}`,
    north: `${seed}_${sectionX}_${sectionY-1}`,
    east: `${seed}_${sectionX+1}_${sectionY}`,
    south: `${seed}_${sectionX}_${sectionY+1}`,
    west: `${seed}_${sectionX-1}_${sectionY}`,
    northeast: `${seed}_${sectionX+1}_${sectionY-1}`,
    southeast: `${seed}_${sectionX+1}_${sectionY+1}`,
    southwest: `${seed}_${sectionX-1}_${sectionY+1}`,
    northwest: `${seed}_${sectionX-1}_${sectionY-1}`
  };
  
  // Generate grid sections
  const sections = {};
  for (const [direction, sectionSeed] of Object.entries(seeds)) {
    sections[direction] = generateLabyrinth(sectionSize, sectionSize, sectionSeed);
  }
  
  return sections;
}

