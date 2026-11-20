import { AudioSettings, VaultId } from '../types/game';

export type AmbienceMode =
  | 'off'
  | 'lab-calm'
  | 'alert-tension'
  | 'gameplay-thriller'
  | 'victory'
  | 'vault-1'
  | 'vault-2'
  | 'vault-3'
  | 'vault-4'
  | 'vault-5';

export function getVaultAmbienceMode(vaultId: VaultId): AmbienceMode {
  return `vault-${vaultId}` as AmbienceMode;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private ambienceNodes: AudioNode[] = [];
  private ambienceMode: AmbienceMode = 'off';
  private alarmInterval: number | null = null;

  private settings: AudioSettings = {
    muted: false,
    musicVolume: 0.45,
    sfxVolume: 0.65,
    voiceEnabled: true,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    return this.ctx;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  public isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.applyVolumes();
    if (this.settings.muted || !this.settings.voiceEnabled) {
      this.stopSpeech();
    }
  }

  private applyVolumes() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.settings.muted ? 0 : 1, now, 0.04);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.04);
  }

  public stopAmbience() {
    if (this.alarmInterval !== null) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    for (const node of this.ambienceNodes) {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // already stopped
      }
    }
    this.ambienceNodes = [];
    this.ambienceMode = 'off';
  }

  public setAmbience(mode: AmbienceMode) {
    if (mode === this.ambienceMode) return;
    this.stopAmbience();
    if (mode === 'off') return;

    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.ambienceMode = mode;
    const now = ctx.currentTime;

    const createDrone = (
      freq: number,
      type: OscillatorType,
      gainVal: number,
      detune = 0,
      cutoff = mode === 'victory' ? 950 : 420
    ) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detune, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + 1.1);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(now);
      this.ambienceNodes.push(osc, filter, gain);
      return { osc, filter, gain };
    };

    const createFilteredNoiseLoop = (
      centerFreq: number,
      q: number,
      gainVal: number,
      lfoHz = 0.25,
      lfoDepth = 85
    ) => {
      const length = Math.floor(ctx.sampleRate * 2.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(centerFreq, now);
      filter.Q.setValueAtTime(q, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + 1.1);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(lfoHz, now);
      lfoGain.gain.setValueAtTime(lfoDepth, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);
      src.start(now);
      lfo.start(now);
      this.ambienceNodes.push(src, filter, gain, lfo, lfoGain);
    };

    if (mode === 'lab-calm') {
      // Calm futuristic research pad (C minor 9 airy drone)
      createDrone(65.41, 'sine', 0.22); // C2
      createDrone(130.81, 'triangle', 0.08, 4); // C3
      createDrone(196.0, 'sine', 0.06, -3); // G3
      createDrone(293.66, 'sine', 0.035, 6); // D4
    } else if (mode === 'alert-tension') {
      // Dark suspenseful sub pulse
      const d1 = createDrone(55.0, 'sawtooth', 0.16);
      createDrone(58.27, 'sawtooth', 0.12, 8); // dissonant minor second
      createDrone(110.0, 'triangle', 0.09);

      // Slow LFO modulating filter cutoff for tension
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(1.4, now);
      lfoGain.gain.setValueAtTime(220, now);
      lfo.connect(lfoGain);
      lfoGain.connect(d1.filter.frequency);
      lfo.start(now);
      this.ambienceNodes.push(lfo, lfoGain);
    } else if (mode === 'gameplay-thriller') {
      // Deep atmospheric sci-fi laboratory thriller drone
      const base = createDrone(48.99, 'sine', 0.2); // G1
      createDrone(97.99, 'triangle', 0.07, -5); // G2
      createDrone(146.83, 'sine', 0.045, 5); // D3
      createDrone(233.08, 'sine', 0.025, 3); // Bb3

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.18, now);
      lfoGain.gain.setValueAtTime(140, now);
      lfo.connect(lfoGain);
      lfoGain.connect(base.filter.frequency);
      lfo.start(now);
      this.ambienceNodes.push(lfo, lfoGain);
    } else if (mode === 'victory') {
      // Uplifting restored facility harmonic chord (C major 9)
      createDrone(130.81, 'sine', 0.14);
      createDrone(164.81, 'sine', 0.1);
      createDrone(196.0, 'triangle', 0.07);
      createDrone(246.94, 'sine', 0.05);
      createDrone(293.66, 'sine', 0.04);
    } else if (mode === 'vault-1') {
      // VAULT 01 (Biological Activity & IC50 Containment): Deep biological rumble + slow organic breathing pulse
      const sub = createDrone(41.2, 'sine', 0.28, 0, 190); // E1 deep containment rumble
      createDrone(42.8, 'sine', 0.14, 0, 180); // subtle 1.6Hz acoustic beat
      const body = createDrone(82.41, 'triangle', 0.1, -4, 240); // E2 warm biological tank hum
      createDrone(123.47, 'sine', 0.045, 3, 280); // B2 low fifth

      const breathLfo = ctx.createOscillator();
      const breathGain = ctx.createGain();
      breathLfo.frequency.setValueAtTime(0.28, now);
      breathGain.gain.setValueAtTime(95, now);
      breathLfo.connect(breathGain);
      breathGain.connect(body.filter.frequency);
      breathGain.connect(sub.filter.frequency);
      breathLfo.start(now);
      this.ambienceNodes.push(breathLfo, breathGain);
    } else if (mode === 'vault-2') {
      // VAULT 02 (Chemical Structure & SMILES Synthesis): Crystalline spectroscopic mid-high harmonic shimmer
      createDrone(110.0, 'sine', 0.14, 0, 620); // A2 clean bench foundation
      createDrone(220.0, 'triangle', 0.075, 5, 950); // A3 molecular glass hum
      const shimmer1 = createDrone(659.25, 'sine', 0.036, -4, 1600); // E5 crystalline resonance
      const shimmer2 = createDrone(880.0, 'sine', 0.024, 6, 1800); // A5 spectral overtone

      const shimmerLfo = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmerLfo.frequency.setValueAtTime(0.52, now);
      shimmerGain.gain.setValueAtTime(0.015, now);
      shimmerLfo.connect(shimmerGain);
      shimmerGain.connect(shimmer1.gain.gain);
      shimmerGain.connect(shimmer2.gain.gain);
      shimmerLfo.start(now);
      this.ambienceNodes.push(shimmerLfo, shimmerGain);
    } else if (mode === 'vault-3') {
      // VAULT 03 (Drug-Likeness & Membrane Permeation): Pressurized laminar-flow filtration + resonant fluidic drone
      const tank = createDrone(55.0, 'sine', 0.22, 0, 260); // A1 fluidic chamber resonance
      createDrone(110.0, 'sine', 0.085, -3, 380); // A2
      createDrone(164.81, 'triangle', 0.045, 4, 480); // E3
      createFilteredNoiseLoop(440, 2.8, 0.042, 0.22, 130); // sterile pressurized airflow whisper

      const flowLfo = ctx.createOscillator();
      const flowGain = ctx.createGain();
      flowLfo.frequency.setValueAtTime(0.32, now);
      flowGain.gain.setValueAtTime(110, now);
      flowLfo.connect(flowGain);
      flowGain.connect(tank.filter.frequency);
      flowLfo.start(now);
      this.ambienceNodes.push(flowLfo, flowGain);
    } else if (mode === 'vault-4') {
      // VAULT 04 (Machine Learning & XGBoost AI Core): High-frequency technological server hum + neural data pulse
      const rack = createDrone(146.83, 'sawtooth', 0.075, 0, 740); // D3 compute rack hum
      createDrone(293.66, 'triangle', 0.065, -3, 1200); // D4 digital bus
      const hiHum1 = createDrone(587.33, 'sine', 0.04, 4, 2100); // D5 high-freq technological hum
      createDrone(1174.66, 'sine', 0.022, -6, 2600); // D6 precision clock whine
      createFilteredNoiseLoop(1650, 3.6, 0.018, 1.4, 220); // subtle server cooling fan air

      const pulseLfo = ctx.createOscillator();
      const pulseGain = ctx.createGain();
      pulseLfo.frequency.setValueAtTime(2.6, now);
      pulseGain.gain.setValueAtTime(240, now);
      pulseLfo.connect(pulseGain);
      pulseGain.connect(rack.filter.frequency);
      pulseGain.connect(hiHum1.filter.frequency);
      pulseLfo.start(now);
      this.ambienceNodes.push(pulseLfo, pulseGain);
    } else if (mode === 'vault-5') {
      // VAULT 05 (Master Containment Core): Monumental deep reactor rumble + high superconducting ring resonance
      const coreSub = createDrone(36.71, 'sine', 0.29, 0, 175); // D1 deep containment foundation
      const coreMid = createDrone(73.42, 'sawtooth', 0.085, 5, 230); // D2 heavy magnetic coil
      const ringHi1 = createDrone(440.0, 'sine', 0.036, -7, 1600); // A4 superconducting ring
      createDrone(880.0, 'sine', 0.024, 7, 2200); // A5 harmonic ring shimmer

      const reactorLfo = ctx.createOscillator();
      const reactorGain = ctx.createGain();
      reactorLfo.frequency.setValueAtTime(0.16, now);
      reactorGain.gain.setValueAtTime(125, now);
      reactorLfo.connect(reactorGain);
      reactorGain.connect(coreSub.filter.frequency);
      reactorGain.connect(coreMid.filter.frequency);
      reactorLfo.start(now);

      const ringLfo = ctx.createOscillator();
      const ringGain = ctx.createGain();
      ringLfo.frequency.setValueAtTime(1.15, now);
      ringGain.gain.setValueAtTime(0.012, now);
      ringLfo.connect(ringGain);
      ringGain.connect(ringHi1.gain.gain);
      ringLfo.start(now);
      this.ambienceNodes.push(reactorLfo, reactorGain, ringLfo, ringGain);
    }
  }

  public startEmergencyAlarm() {
    this.stopEmergencyAlarm();
    this.playAlarmPulse();
    this.alarmInterval = window.setInterval(() => {
      this.playAlarmPulse();
    }, 1500);
  }

  public stopEmergencyAlarm() {
    if (this.alarmInterval !== null) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  private playAlarmPulse() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.55);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.65);
  }

  public playElectricalSpark() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const duration = 0.28;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 2.2);
      data[i] = (Math.random() * 2 - 1) * env * (Math.random() > 0.45 ? 1 : 0.2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  public playPowerDown() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 1.15);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 1.15);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.25);
  }

  public playBlastDoorSlam() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Sub impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.55);

    // Metallic clank
    this.playElectricalSpark();
  }

  public playDoorSlide() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(240, now + 0.35);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playHologramActivate() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const freqs = [330, 495, 660, 990];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      gain.gain.setValueAtTime(0.001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.11, now + idx * 0.07 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.6);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.65);
    });
  }

  public playButtonClick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.055);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playTerminalOpen() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [520, 780].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(0.12, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.16);
    });
  }

  public playCorrect() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      gain.gain.setValueAtTime(0.16, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.28);
    });
  }

  public playIncorrect() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [220, 185].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.12);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.14, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.18);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.22);
    });
  }

  public playKeyCollected() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.09);
      gain.gain.setValueAtTime(0.16, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.48);
    });
  }

  public playVaultUnlock() {
    this.playDoorSlide();
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    [392, 587.33, 783.99].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + 0.15 + i * 0.1);
      gain.gain.setValueAtTime(0.14, now + 0.15 + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15 + i * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + 0.15 + i * 0.1);
      osc.stop(now + 0.15 + i * 0.1 + 0.4);
    });
  }

  public playKeyInsert() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Crisp metallic latch + rising harmonic confirmation
    [220, 440, 659.25, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'square' : 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.055);
      gain.gain.setValueAtTime(i === 0 ? 0.1 : 0.16, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.34);
    });
  }

  public playFireworkBurst() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    // Low boom thump
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(145, now);
    boom.frequency.exponentialRampToValueAtTime(36, now + 0.24);
    boomGain.gain.setValueAtTime(0.28, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    boom.connect(boomGain);
    boomGain.connect(this.sfxGain);
    boom.start(now);
    boom.stop(now + 0.3);

    // Sparkling crackle noise tail
    const duration = 0.55;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const progress = i / bufferSize;
      const env = Math.pow(1 - progress, 1.8);
      const crackle = Math.random() > 0.72 ? 1 : 0.15;
      data[i] = (Math.random() * 2 - 1) * env * crackle;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(1.1, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.22, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
  }

  public playChemicalHiss() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const duration = 0.85;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const p = i / bufferSize;
      const env = Math.sin(p * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.frequency.exponentialRampToValueAtTime(1900, now + duration);
    filter.Q.setValueAtTime(2.6, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  public playDistantLabCreak() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(74, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 1.4);
    osc2.frequency.setValueAtTime(111, now);
    osc2.frequency.exponentialRampToValueAtTime(61, now + 1.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 1.55);
    osc2.stop(now + 1.55);
  }

  public playHeartbeatPulse() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // Double thump lub-dub
    [0, 0.24].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 64 : 52, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.16);
      gain.gain.setValueAtTime(idx === 0 ? 0.32 : 0.22, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.19);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.21);
    });
  }

  public playVictoryFanfare() {
    this.setAmbience('victory');
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.11);
      gain.gain.setValueAtTime(0.18, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.85);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.9);
    });
  }

  public speakNexus(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.settings.muted || !this.settings.voiceEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 0.92;
      utterance.volume = Math.min(1, Math.max(0.15, this.settings.sfxVolume));

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /en/i.test(v.lang) && /(samantha|google us english|daniel|alex|aria|jenny)/i.test(v.name)) ||
        voices.find((v) => /^en/i.test(v.lang));
      if (preferred) {
        utterance.voice = preferred;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis blocked or unavailable; subtitles remain visible
    }
  }

  public stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export const soundEngine = new SoundEngine();
