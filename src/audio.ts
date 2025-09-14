const A_440 = 440;
const SEMITONE_RATIO = Math.pow(2, 1/12);
// const SCALE_SEMITONES = [-12, -10, -8, -7, -5, -3, -2, 0, 2, 4, 5, 7, 9, 11, 12]; // C major scale
const SCALE_SEMITONES = [-9, -7, -5, -4, -2, 0, 2, 3, 5, 7, 8, 10, 12];
export function frequencyForNodeIndex(index: number): number {
  return A_440 * Math.pow(SEMITONE_RATIO, index);
}

export function playTone(frequency: number, duration: number): void {
  console.log(`Playing tone: ${frequency} Hz for ${duration} ms`);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(25, audioCtx.currentTime); // Cutoff frequency
  filter.frequency.exponentialRampToValueAtTime(frequency, audioCtx.currentTime + duration / 1000); // Sweep up
  // filter.frequency.linearRampToValueAtTime(frequency, audioCtx.currentTime + duration / 1000); // Sweep up
  filter.Q.setValueAtTime(5, audioCtx.currentTime); // Resonance
  // filter.Q.linearRampToValueAtTime(0.5, audioCtx.currentTime + duration / 1000); // Decrease resonance

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime); // Lower volume

  const attack = duration * 0.25 / 1000; // seconds
  const decay = duration * 0.75 / 1000; // seconds
  const sustain = 0.0; // volume level (0 to 1)
  // const release = 0.2; // seconds
  // Attack
  gainNode.gain.cancelAndHoldAtTime(audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + attack);

  // Decay
  gainNode.gain.linearRampToValueAtTime(sustain, audioCtx.currentTime + attack + decay);

  // Release (after a duration, not shown here for brevity)
  // gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + attack + decay + release);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration / 1000 + 0.2); // slight buffer to ensure it stops after gain envelope

  oscillator.onended = () => {
    audioCtx.close();
  };
}

function playScaledTone(nodeIndex: number, duration: number, cb: (frequency: number, duration: number) => void): void {
  const scaleIndex = ((nodeIndex % SCALE_SEMITONES.length) + SCALE_SEMITONES.length) % SCALE_SEMITONES.length;
  const semitoneOffset = SCALE_SEMITONES[scaleIndex];
  const frequency = frequencyForNodeIndex(semitoneOffset);
  cb(frequency, duration);
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
  console.log(`Playing selected tone: ${frequency} Hz for ${duration} ms (band-pass)`);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, audioCtx.currentTime); // Centered on frequency
  // Start with a wide Q (low resonance, wide band)
  filter.Q.setValueAtTime(1, audioCtx.currentTime);
  // Ramp Q up to narrow the band over the duration
  filter.Q.linearRampToValueAtTime(25, audioCtx.currentTime + duration / 1000);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  const attack = duration * 0.25 / 1000;
  const decay = duration * 0.75 / 1000;
  const sustain = 0.0;
  gainNode.gain.cancelAndHoldAtTime(audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.7, audioCtx.currentTime + attack);
  gainNode.gain.linearRampToValueAtTime(sustain, audioCtx.currentTime + attack + decay);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration / 1000 + 0.2);

  oscillator.onended = () => {
    audioCtx.close();
  };
}