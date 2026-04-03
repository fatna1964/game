
import { generateSequence } from "./physics";
import { MISSION_LENGTH } from "./constants";

export function createMission() {
  return {
    code: generateSequence(MISSION_LENGTH),
  };
}