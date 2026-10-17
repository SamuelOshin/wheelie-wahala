// The Garage: bikes, paints and trails, bought with coins.
// Bikes feel different but are tuned to the same pace (see tools/bike-check.mjs), so
// nothing you buy decides a leaderboard place.
import { TUNING } from './physics.js';

// stats are for the shop cards (1–5), not the physics.
export const BIKES = [
  {
    id: 'dirt', name: 'Dirt', price: 0, blurb: 'Balanced. Good at everything',
    stats: { speed: 3, grip: 3, spin: 3, weight: 3 }, tuning: {},
  },
  {
    id: 'trials', name: 'Trials', price: 300, blurb: 'Grippy and punchy. Climbs anything',
    stats: { speed: 2, grip: 5, spin: 3, weight: 2 },
    tuning: { motorTorque: 14, topSpeed: 58, wheelFriction: 2.1, suspensionHz: 3.8, groundLeanTorque: 17, airSpin: 8 },
  },
  {
    id: 'sport', name: 'Sport', price: 500, blurb: 'Fast and heavy. Stable in the air',
    stats: { speed: 5, grip: 2, spin: 2, weight: 5 },
    tuning: { topSpeed: 66, motorTorque: 10.5, chassisDensity: 5.2, airSpin: 7.6, airResponse: 6, wheelFriction: 1.45 },
  },
  {
    id: 'stunt', name: 'Stunt', price: 800, blurb: 'Light and twitchy. Spins like crazy',
    stats: { speed: 3, grip: 3, spin: 5, weight: 1 },
    tuning: { airSpin: 10.8, airResponse: 9.5, chassisDensity: 3.1, riderDensity: 1.7, motorTorque: 10.2, groundLeanTorque: 12 },
  },
  {
    id: 'chopper', name: 'Chopper', price: 1200, blurb: 'Long and steady. Pure style',
    stats: { speed: 4, grip: 3, spin: 2, weight: 4 },
    tuning: { rearWheel: [-0.74, -0.42], frontWheel: [0.9, -0.42], topSpeed: 64, chassisDensity: 4.6, airSpin: 7.2, groundLeanTorque: 13 },
  },
];

// main: tank, fenders and bodywork. accent: stripes and number boards.
export const PAINTS = [
  { id: 'red', name: 'Wahala Red', price: 0, main: '#d7262b', accent: '#f4f4f4' },
  { id: 'blue', name: 'Lagoon Blue', price: 60, main: '#2d6cdf', accent: '#ffe14d' },
  { id: 'green', name: 'Naija Green', price: 80, main: '#008751', accent: '#ffffff' },
  { id: 'black', name: 'Midnight', price: 100, main: '#1f2026', accent: '#e5383b' },
  { id: 'white', name: 'Snow', price: 100, main: '#f2f2f2', accent: '#3a86ff' },
  { id: 'pink', name: 'Bubblegum', price: 150, main: '#ff5fa2', accent: '#ffffff' },
  { id: 'danfo', name: 'Danfo Yellow', price: 200, main: '#f7c600', accent: '#1d1d1d' },
  { id: 'gold', name: 'Gold Rush', price: 600, main: '#e8b923', accent: '#7a4f00', shine: true },
];

export const TRAILS = [
  { id: 'none', name: 'No trail', price: 0 },
  { id: 'smoke', name: 'Smoke', price: 120 },
  { id: 'sparks', name: 'Sparks', price: 200 },
  { id: 'confetti', name: 'Confetti', price: 300 },
  { id: 'naija', name: 'Green-White-Green', price: 350 },
  { id: 'fire', name: 'Fire', price: 450 },
  { id: 'rainbow', name: 'Rainbow', price: 700 },
];

export const CATALOGUE = { bikes: BIKES, paints: PAINTS, trails: TRAILS };

export function bikeById(id) {
  return BIKES.find((b) => b.id === id) ?? BIKES[0];
}

export function paintById(id) {
  return PAINTS.find((p) => p.id === id) ?? PAINTS[0];
}

// Physics settings for a bike: the base TUNING with the bike's changes on top.
export function tuningFor(id) {
  return { ...TUNING, ...bikeById(id).tuning };
}

// Saved state in progress.garage. Free items are always owned.
export function defaultGarage() {
  return { bike: 'dirt', paint: 'red', trail: 'none', owned: { bikes: ['dirt'], paints: ['red'], trails: ['none'] } };
}

export function owns(garage, kind, id) {
  const item = CATALOGUE[kind].find((x) => x.id === id);
  return !!item && (item.price === 0 || garage.owned[kind].includes(id));
}
