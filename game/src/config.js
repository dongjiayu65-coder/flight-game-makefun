// config.js — every tunable number of Ridgeline Post in one place:
// the physics constants, the three missions of the campaign, and the
// colour palettes each mission flies under. Nothing here touches the
// DOM or the canvas; the other modules read from these tables only.

export const WORLD = {
  // The valley runs along +Z. Terrain is generated for x in
  // [-halfWidth, +halfWidth]; the flyable course is the valley floor.
  halfWidth: 900,
  // Heightfield sample spacing in metres, along and across.
  stepAcross: 60,
  stepAlong: 120,
  // How far ahead of the camera the renderer draws terrain strips.
  viewDistance: 4200,
  // Sea level of the world: the valley floor sits a little above it.
  baseHeight: 320,
};

export const PLANE = {
  // Speeds are metres per second, shown to the pilot as knots.
  stallSpeed: 24,
  cruiseSpeed: 48,
  maxSpeed: 82,
  // Vertical speed limits the airframe tolerates on touchdown.
  landingMaxSink: 3.2,
  landingMaxSpeed: 44,
  // Fuel is counted in abstract units; a full tank is 100.
  fuelCapacity: 100,
  // Fuel burn per second at full throttle; idle still sips a little.
  fuelBurnFull: 0.55,
  fuelBurnIdle: 0.08,
};

export const MISSIONS = [
  {
    id: 'first-delivery',
    name: 'Mission 1 — First Delivery',
    short: 'Calm morning. Learn the valley, thread six rings, land at Lark Strip.',
    seed: 1123,
    length: 15000, // metres from start line to the runway threshold
    rings: 6,
    fuel: 78,
    startSpeed: 46,
    startAltitude: 210, // metres above the valley floor at the start line
    wind: { x: 0.6, gust: 0.0 },
    palette: 'morning',
    parTime: 300,
  },
  {
    id: 'river-run',
    name: 'Mission 2 — River Run',
    short: 'Follow the river low and quick. Eight rings, a tighter tank, a crosswind.',
    seed: 7421,
    length: 19500,
    rings: 8,
    fuel: 66,
    startSpeed: 52,
    startAltitude: 170,
    wind: { x: 2.4, gust: 0.7 },
    palette: 'noon',
    parTime: 330,
  },
  {
    id: 'storm-pass',
    name: 'Mission 3 — Storm Pass',
    short: 'Dusk storm over the high pass. Gusts shove the wings; the strip is short on fuel and long on weather.',
    seed: 9917,
    length: 22500,
    rings: 8,
    fuel: 58,
    startSpeed: 54,
    startAltitude: 240,
    wind: { x: -3.4, gust: 2.6 },
    palette: 'storm',
    parTime: 360,
  },
];

// Sky, fog and terrain colours per palette. Terrain itself is shaded
// from these bases by height and slope inside render.js.
export const PALETTES = {
  morning: {
    skyTop: '#2e5f8a', skyHorizon: '#cfe4ee', fog: '#c3d9e6',
    sun: '#fff3cf',
    grass: '#5d8a4a', dry: '#9aa055', rock: '#8d8578', snow: '#f4f7f7',
    water: '#3f7d99', sand: '#c9bd93',
  },
  noon: {
    skyTop: '#2b6cb8', skyHorizon: '#d8ecf7', fog: '#cfe2ee',
    sun: '#ffffff',
    grass: '#4f9142', dry: '#a3a35c', rock: '#8a8175', snow: '#f7fafa',
    water: '#2f7fa8', sand: '#d3c69c',
  },
  storm: {
    skyTop: '#3a4356', skyHorizon: '#9aa5ad', fog: '#8d979e',
    sun: '#d8d3c3',
    grass: '#4c6b41', dry: '#7d7f52', rock: '#6f6a61', snow: '#e8ecec',
    water: '#33586b', sand: '#a89a7c',
  },
};

// Ring course layout knobs, shared by every mission.
export const COURSE = {
  // First ring this far past the start line, then roughly even spacing.
  firstRing: 2600,
  // Rings wander this far sideways from the valley centre line.
  ringWander: 260,
  // Ring radius in metres; flying through the disc scores.
  ringRadius: 26,
};
