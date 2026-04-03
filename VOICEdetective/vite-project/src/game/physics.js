
import {
  BOARD_W,
  BOARD_H,
  COLS,
  ROWS,
  CELL_W,
  CELL_H,
  SENSORS,
} from "./constants";

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function zoneCenter(zone) {
  const i = zone - 1;
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return {
    x: col * CELL_W + CELL_W / 2,
    y: row * CELL_H + CELL_H / 2,
  };
}

export function pointToZone(point) {
  const col = clamp(Math.floor(point.x / CELL_W), 0, COLS - 1);
  const row = clamp(Math.floor(point.y / CELL_H), 0, ROWS - 1);
  return row * COLS + col + 1;
}

export function randomZone() {
  return 1 + Math.floor(Math.random() * 12);
}

export function generateSequence(length = 4) {
  return Array.from({ length }, () => randomZone());
}

export function jitter(center, rx, ry) {
  return {
    x: center.x + (Math.random() * 2 - 1) * rx,
    y: center.y + (Math.random() * 2 - 1) * ry,
  };
}

export function buildWaveEvent(zone, speed, noiseMs) {
  const center = zoneCenter(zone);
  const source = jitter(center, CELL_W * 0.18, CELL_H * 0.18);

  const raw = SENSORS.map((sensor) => ({
    id: sensor.id,
    distance: dist(source, sensor),
  }));

  const minArrival = Math.min(...raw.map((r) => r.distance / speed));

  const times = raw
    .map((r) => ({
      id: r.id,
      distance: r.distance,
      t: (r.distance / speed - minArrival) * 1000 + (Math.random() * 2 - 1) * noiseMs,
    }))
    .sort((a, b) => a.t - b.t);

  return { zone, source, times };
}

export function estimateSource(times, speed) {
  let best = { err: Infinity, x: BOARD_W / 2, y: BOARD_H / 2 };

  const measured = times.map((t) => ({ ...t, sec: t.t / 1000 }));

  for (let x = 0; x <= BOARD_W; x += 6) {
    for (let y = 0; y <= BOARD_H; y += 6) {
      const predicted = SENSORS.map((sensor) => ({
        id: sensor.id,
        sec: dist({ x, y }, sensor) / speed,
      }));

      const predMin = Math.min(...predicted.map((p) => p.sec));
      let err = 0;

      for (const m of measured) {
        const p = predicted.find((q) => q.id === m.id);
        err += (m.sec - (p.sec - predMin)) ** 2;
      }

      if (err < best.err) {
        best = { err, x, y };
      }
    }
  }

  return best;
}

export function solverConfidence(estimated, actual) {
  const d = dist(estimated, actual);
  return Math.max(0, Math.round(100 - d / 5));
}