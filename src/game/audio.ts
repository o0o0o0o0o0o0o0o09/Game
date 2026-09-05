/* Крошечный WebAudio-синтезатор: все звуки генерируются кодом. */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private laserOsc: OscillatorNode | null = null;
  private laserGain: GainNode | null = null;
  muted = false;

  /** Вызывается по первому пользовательскому жесту. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.32;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, q = 0.8, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(filterFreq, t0);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shootPistol() {
    this.tone(520, 0.09, "square", 0.16, 140);
    this.noise(0.05, 0.1, 3200, 1);
  }
  shootSmg() {
    this.tone(640, 0.05, "square", 0.1, 220);
    this.noise(0.03, 0.07, 4200, 1);
  }
  shootShotgun() {
    this.noise(0.22, 0.3, 900, 0.5);
    this.tone(140, 0.18, "triangle", 0.26, 60);
  }
  laserOn() {
    if (!this.ctx || !this.master || this.laserOsc || this.muted) return;
    this.laserOsc = this.ctx.createOscillator();
    this.laserGain = this.ctx.createGain();
    this.laserOsc.type = "sawtooth";
    this.laserOsc.frequency.value = 92;
    this.laserGain.gain.value = 0;
    this.laserGain.gain.linearRampToValueAtTime(0.055, this.ctx.currentTime + 0.06);
    this.laserOsc.connect(this.laserGain).connect(this.master);
    this.laserOsc.start();
  }
  laserOff() {
    if (!this.ctx || !this.laserOsc || !this.laserGain) return;
    const t = this.ctx.currentTime;
    this.laserGain.gain.cancelScheduledValues(t);
    this.laserGain.gain.setValueAtTime(this.laserGain.gain.value, t);
    this.laserGain.gain.linearRampToValueAtTime(0, t + 0.08);
    this.laserOsc.stop(t + 0.1);
    this.laserOsc = null;
    this.laserGain = null;
  }
  hit() {
    this.noise(0.04, 0.12, 1800, 1.4);
  }
  crit() {
    this.tone(880, 0.08, "square", 0.14, 300);
  }
  kill() {
    this.noise(0.2, 0.2, 500, 0.6);
    this.tone(220, 0.22, "sawtooth", 0.14, 40);
  }
  bruteKill() {
    this.noise(0.42, 0.3, 260, 0.5);
    this.tone(120, 0.4, "sawtooth", 0.2, 30);
  }
  hurt() {
    this.tone(110, 0.25, "sawtooth", 0.3, 45);
    this.noise(0.14, 0.2, 400, 0.6);
  }
  upgrade() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, 0.16, "triangle", 0.16, undefined, i * 0.07));
  }
  waveHorn() {
    this.tone(196, 0.5, "sawtooth", 0.14, 196);
    this.tone(294, 0.5, "sawtooth", 0.12, 294, 0.05);
    this.tone(392, 0.62, "triangle", 0.14, 392, 0.12);
  }
  waveClear() {
    this.tone(660, 0.14, "square", 0.12);
    this.tone(990, 0.22, "square", 0.12, undefined, 0.09);
  }
  gameOver() {
    const seq = [392, 311, 233, 155];
    seq.forEach((f, i) => this.tone(f, 0.4, "sawtooth", 0.16, f * 0.92, i * 0.18));
  }
  uiHover() {
    this.tone(1400, 0.035, "sine", 0.05);
  }
  uiClick() {
    this.tone(700, 0.06, "square", 0.1, 500);
    this.noise(0.03, 0.06, 3000, 1);
  }
}
