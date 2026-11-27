import { drawChip, drawNode } from "./draw";

const FILL_IN_TIME = 1000; // ms
const ROTATION_PERIOD = 1500; // ms
const START_ARC_LENGTH = 0.25 * 2 * Math.PI; // radians
const FILL_IN_ARC_LENGTH = 0.75 * 2 * Math.PI; // radians
const PULSE_PERIOD = 750; // ms
const PULSE_MAGNITUDE = 0.05; // fraction of radius
/** A ranked node swells by this much and back when its rank appears. Matches PICK_STAGGER. */
export const RANK_PULSE_TIME = 300; // ms
export const RANK_PULSE_MAGNITUDE = 0.12; // fraction of radius

/** Extra scale for a node `sinceReveal` ms after its rank appears: up and back down once. */
export function rankPulse(sinceReveal: number): number {
  if (sinceReveal < 0 || sinceReveal >= RANK_PULSE_TIME) return 0;
  return RANK_PULSE_MAGNITUDE * Math.sin((Math.PI * sinceReveal) / RANK_PULSE_TIME);
}

export interface NodeState {
  id: string;
  color: string;
  x: number;
  y: number;
  placedTime: DOMHighResTimeStamp;
  getArcStart(elapsed: number): number;
  getArcEnd(elapsed: number): number;
}

export class Node implements NodeState {
  id: string;
  color: string;
  x: number;
  y: number;
  /** Index into the audio scale; used for this finger's place, lift and win sounds. */
  toneIndex: number;
  placedTime: DOMHighResTimeStamp;
  /** When the pick was made, if this node was kept. Freezes the pulse; the results renderer uses it to animate. */
  selectedTime: DOMHighResTimeStamp | undefined = undefined;
  /** Place in a ranking (1 = first), once ranked. Shown from `selectedTime` on. */
  rank: number | undefined = undefined;

  constructor(
    id: string,
    color: string,
    x: number,
    y: number,
    toneIndex = 0,
    placedTime: DOMHighResTimeStamp = performance.now()
  ) {
    this.id = id;
    this.color = color;
    this.x = x;
    this.y = y;
    this.toneIndex = toneIndex;
    this.placedTime = placedTime;
  }
  
  getArcStart(elapsed: number): number {
    const rotation = (elapsed % ROTATION_PERIOD) / ROTATION_PERIOD;
    return rotation * (2 * Math.PI);
  }
  
  getArcEnd(elapsed: number): number {
    const fillProgress = Math.min(elapsed / FILL_IN_TIME, 1);
    return this.getArcStart(elapsed) + START_ARC_LENGTH + (FILL_IN_ARC_LENGTH * fillProgress);
  }
  
  draw(ctx: CanvasRenderingContext2D, radius: number): void {
    const now = performance.now();
    const elapsed = now - this.placedTime;
    const pulseTime = (this.selectedTime || now) - this.placedTime;
    const pulse = (Math.sin((2 * Math.PI * (pulseTime % PULSE_PERIOD)) / PULSE_PERIOD) + 1) / 2;
    const actualRadius = radius * (1 + (PULSE_MAGNITUDE * pulse));

    if (this.rank !== undefined && this.selectedTime !== undefined && now >= this.selectedTime) {
      const scale = 1 + rankPulse(now - this.selectedTime);
      drawChip(ctx, this.x, this.y, actualRadius * scale, this.color, String(this.rank));
      return;
    }
    drawNode(ctx, this.x, this.y, actualRadius, this.color, this.getArcStart(elapsed), this.getArcEnd(elapsed));
  }
}