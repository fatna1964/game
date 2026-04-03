
export const BOARD_W = 900;
export const BOARD_H = 540;
export const COLS = 4;
export const ROWS = 3;
export const CELL_W = BOARD_W / COLS;
export const CELL_H = BOARD_H / ROWS;

export const DEFAULT_SPEED = 320;
export const DEFAULT_NOISE = 0.12;
export const MISSION_LENGTH = 4;

export const SENSORS = [
  { id: "S1", x: 40, y: 40 },
  { id: "S2", x: BOARD_W - 40, y: 40 },
  { id: "S3", x: 40, y: BOARD_H - 40 },
  { id: "S4", x: BOARD_W - 40, y: BOARD_H - 40 },
];