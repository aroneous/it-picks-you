import { drawNode } from "./draw";

const FILL_IN_TIME = 1000; // ms
const ROTATION_PERIOD = 1500; // ms
const START_ARC_LENGTH = 0.25 * 2 * Math.PI; // radians
const FILL_IN_ARC_LENGTH = 0.75 * 2 * Math.PI; // radians

export interface NodeState {
  id: string;
  color: string;
  x: number;
  y: number;
  placedTime: DOMHighResTimeStamp;
  readonly arcStart: number;
  readonly arcEnd: number;
}

export class Node implements NodeState {
  id: string;
  color: string;
  x: number;
  y: number;
  placedTime: DOMHighResTimeStamp;

  constructor(id: string, color: string, x: number, y: number) {
    this.id = id;
    this.color = color;
    this.x = x;
    this.y = y;
    this.placedTime = performance.now();
  }
  
  get arcStart(): number {
    const elapsed = performance.now() - this.placedTime;
    const rotation = (elapsed % ROTATION_PERIOD) / ROTATION_PERIOD;
    return rotation * (2 * Math.PI);
  }
  
  get arcEnd(): number {
    const elapsed = performance.now() - this.placedTime;
    const fillProgress = Math.min(elapsed / FILL_IN_TIME, 1);
    return this.arcStart + START_ARC_LENGTH + (FILL_IN_ARC_LENGTH * fillProgress);
  }
  
  draw(ctx: CanvasRenderingContext2D, radius: number): void {
    drawNode(ctx, this.x, this.y, radius, this.color, this.arcStart, this.arcEnd);
  }
}