const A_440 = 440;
const SEMITONE_RATIO = Math.pow(2, 1/12);
const SCALE_SEMITONES = [-9, -7, -5, -4, -2, 0, 2, 3, 5, 7, 8, 10, 12];

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterCompressor: DynamicsCompressorNode | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.8, audioCtx.currentTime);

    masterCompressor = audioCtx.createDynamicsCompressor();
    // Typical "limiter" settings to prevent clipping
    masterCompressor.threshold.setValueAtTime(-12, audioCtx.currentTime);
    masterCompressor.knee.setValueAtTime(30, audioCtx.currentTime);
    masterCompressor.ratio.setValueAtTime(12, audioCtx.currentTime);
    masterCompressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    masterCompressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioCtx.destination);
  }
  return { audioCtx, masterGain };
}

export function resumeAudioContext(): void {
  const { audioCtx } = getAudioContext();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function frequencyForNodeIndex(index: number): number {
  return A_440 * Math.pow(SEMITONE_RATIO, index);
}

/**
 * The frequency a tone index plays at: its step in SCALE_SEMITONES, wrapping around.
 * Within the scale's length, higher tone indexes are higher pitches; round.ts relies on
 * that to reveal winners lowest note first.
 */
export function frequencyForTone(toneIndex: number): number {
  const scaleIndex = ((toneIndex % SCALE_SEMITONES.length) + SCALE_SEMITONES.length) % SCALE_SEMITONES.length;
  return frequencyForNodeIndex(SCALE_SEMITONES[scaleIndex]);
}

export function playTone(frequency: number, duration: number): void {
  const { audioCtx, masterGain } = getAudioContext();
  const oscillator = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  filter.Q.setValueAtTime(15, audioCtx.currentTime); 
  filter.Q.linearRampToValueAtTime(1, audioCtx.currentTime + duration / 1000);

  const durationSec = duration / 1000;
  const attack = Math.min(0.05, durationSec * 0.1);
  const decay = durationSec - attack;

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + attack + decay);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain!);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + durationSec + 0.1);
}

function playScaledTone(nodeIndex: number, duration: number, cb: (frequency: number, duration: number) => void): void {
  cb(frequencyForTone(nodeIndex), duration);
}

export function playScaleTone(nodeIndex: number, duration: number): void {
  playScaledTone(nodeIndex, duration, playTone);
}

export function playScaleSelectedTone(nodeIndex: number, duration: number): void {
  playScaledTone(nodeIndex, duration, playSelectedTone);
}

export function playScale(duration: number): void {
  SCALE_SEMITONES.forEach((semitoneOffset, i) => {
    const frequency = frequencyForNodeIndex(semitoneOffset);
    setTimeout(() => {
      playTone(frequency, duration);
    }, i * (duration + 100));
  });
}

export function playSelectedTone(frequency: number, duration: number): void {
  const { audioCtx, masterGain } = getAudioContext();
  const oscillator = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  filter.Q.setValueAtTime(1, audioCtx.currentTime);
  filter.Q.linearRampToValueAtTime(20, audioCtx.currentTime + duration / 1000);

  const durationSec = duration / 1000;
  const attack = Math.min(0.1, durationSec * 0.2);
  const decay = durationSec - attack;

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + attack + decay);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain!);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + durationSec + 0.1);
}