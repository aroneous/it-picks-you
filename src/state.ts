import { drawNode } from "./draw";

const FILL_IN_TIME = 1000; // ms
const ROTATION_PERIOD = 1500; // ms
const START_ARC_LENGTH = 0.25 * 2 * Math.PI; // radians
const FILL_IN_ARC_LENGTH = 0.75 * 2 * Math.PI; // radians
const PULSE_PERIOD = 750; // ms
const PULSE_MAGNITUDE = 0.05; // fraction of radius

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

    drawNode(ctx, this.x, this.y, actualRadius, this.color, this.getArcStart(elapsed), this.getArcEnd(elapsed));
  }
}