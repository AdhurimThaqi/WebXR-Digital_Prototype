// Sound for SPIN, VR Table Tennis. Everything is synthesised live with the
// Web Audio API: no sound files. Browsers only allow audio after a click,
// so PPAudio.start() is called on the first click / Enter VR.
//
// Ball sounds are 3D (HRTF panners), so you hear the ball move left/right
// and far/near. The crowd murmurs, reacts to long rallies and cheers points.

window.PPAudio = (() => {
  let ctx = null;
  let master, reverbIn, sfxBus, crowdBus, musicBus, noiseBuffer;
  let crowd = null;
  let musicOn = true;
  let nextBeat = 0, beatIndex = 0;

  // ---------------------------------------------------------------- setup
  function start() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 4;
      compressor.connect(ctx.destination);
      master = gain(0.9, compressor);

      // A big arena reverb, made from decaying noise
      const reverb = ctx.createConvolver();
      reverb.buffer = impulseResponse(2.8, 3);
      reverbIn = gain(1, reverb);
      reverb.connect(master);

      sfxBus = bus(1.0, 0.16);
      crowdBus = bus(0.6, 0.35);
      musicBus = bus(musicOn ? 0.2 : 0, 0.25);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      startCrowd();
      nextBeat = ctx.currentTime + 0.3;
      setInterval(scheduleMusic, 100);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function gain(value, destination) {
    const node = ctx.createGain();
    node.gain.value = value;
    if (destination) node.connect(destination);
    return node;
  }

  // A mixer channel with a dry level and a reverb send
  function bus(level, reverbAmount) {
    const node = gain(level, master);
    node.connect(gain(reverbAmount, reverbIn));
    return node;
  }

  function impulseResponse(seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  function noise(offset) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.loopStart = 0;
    src.start(ctx.currentTime, offset || Math.random() * 1.5);
    return src;
  }

  function filter(type, frequency, Q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = Q || 0.7;
    return f;
  }

  // A 3D sound source at a world position
  function spatial(pos, level) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 0.7;
    p.rolloffFactor = 0.9;
    if (p.positionX) {
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
    p.connect(sfxBus);
    return gain(level, p);
  }

  // A short pitched blip with an exponential decay
  function tone(dest, type, f0, f1, t, dur, peak) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const env = gain(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A short filtered noise burst
  function burst(dest, type, frequency, Q, t, dur, peak) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = filter(type, frequency, Q);
    const env = gain(0, dest);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(env);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- listener
  function setListener(pos, fwd, up) {
    if (!ctx) return;
    const l = ctx.listener;
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  // ---------------------------------------------------------------- ball sounds
  // strength goes from 0 (soft touch) to 1 (full smash)
  function paddle(pos, strength) {
    if (!ctx) return;
    const s = Math.min(1, Math.max(0.1, strength));
    const t = ctx.currentTime;
    const out = spatial(pos, 0.5 + 0.8 * s);
    tone(out, 'sine', 1100 + 350 * s, 780, t, 0.07, 0.55);        // hollow "pok" of the ball
    tone(out, 'triangle', 2700, 2300, t, 0.025, 0.2);
    burst(out, 'bandpass', 3400, 1.4, t, 0.03, 0.35 + 0.7 * s);    // rubber contact
    burst(out, 'lowpass', 500, 0.8, t, 0.06, 0.3 * s);             // wooden blade
    if (s > 0.75) burst(out, 'highpass', 5200, 0.7, t, 0.05, 0.9 * s); // smash crack
  }

  function table(pos, strength) {
    if (!ctx) return;
    const s = Math.min(1, Math.max(0.2, strength));
    const t = ctx.currentTime;
    const out = spatial(pos, 0.45 + 0.6 * s);
    tone(out, 'sine', 1850, 1500, t, 0.045, 0.5);
    burst(out, 'bandpass', 4200, 1.8, t, 0.02, 0.5 * s + 0.2);
    tone(out, 'sine', 190, 120, t, 0.09, 0.35 * s);                  // table body thump
  }

  function net(pos) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const out = spatial(pos, 0.9);
    burst(out, 'lowpass', 900, 0.8, t, 0.16, 0.7);
    tone(out, 'triangle', 240, 140, t, 0.1, 0.25);
    burst(out, 'bandpass', 2400, 3, t + 0.02, 0.08, 0.15);           // net rattle
  }

  // The ball bouncing away on the floor, a little tick-tick-tick
  function floor(pos) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const out = spatial(pos, 0.7);
    const gaps = [0, 0.3, 0.52, 0.68, 0.79, 0.87, 0.92];
    gaps.forEach((gap, i) => {
      const a = Math.pow(0.72, i);
      tone(out, 'sine', 1500, 1250, t0 + gap, 0.04, 0.4 * a);
      burst(out, 'bandpass', 3200, 1.5, t0 + gap, 0.02, 0.35 * a);
    });
  }

  function whoosh(pos) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = filter('bandpass', 500, 2);
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
    const env = gain(0, spatial(pos, 1));
    env.gain.linearRampToValueAtTime(0.5, t + 0.06);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.connect(f).connect(env);
    src.start(t);
    src.stop(t + 0.3);
  }

  // ---------------------------------------------------------------- interface sounds
  function bell(freq, t, level) {
    const out = gain(level, sfxBus);
    out.connect(gain(0.6, reverbIn));
    tone(out, 'sine', freq, freq, t, 1.2, 0.35);
    tone(out, 'sine', freq * 2.76, freq * 2.76, t, 0.5, 0.08);
    tone(out, 'triangle', freq * 0.5, freq * 0.5, t, 0.8, 0.12);
  }

  function chime(kind) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    const notes = {
      point: [784, 1175],
      lose: [659, 494],
      start: [523, 659, 784, 1047],
      win: [523, 659, 784, 1047, 1319, 1568],
      serve: [988],
    }[kind] || [880];
    notes.forEach((n, i) => bell(n, t + i * 0.11, kind === 'win' ? 0.8 : 0.6));
  }

  function click() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const out = gain(0.5, sfxBus);
    tone(out, 'sine', 1900, 1400, t, 0.05, 0.4);
    burst(out, 'highpass', 6000, 0.7, t, 0.015, 0.2);
  }

  // ---------------------------------------------------------------- crowd
  function startCrowd() {
    // The room tone: a soft wash of many far-away voices
    const base = gain(0, crowdBus);
    noise().connect(filter('bandpass', 620, 0.55)).connect(filter('lowpass', 1800)).connect(base);
    base.gain.setTargetAtTime(0.32, ctx.currentTime, 2);

    // A handful of nearer "voices": noise through moving vowel formants
    const voices = [];
    for (let i = 0; i < 6; i++) {
      const f = filter('bandpass', 400 + Math.random() * 800, 4 + Math.random() * 4);
      const level = gain(0);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const src = noise();
      if (pan) { pan.pan.value = Math.random() * 2 - 1; src.connect(f).connect(level).connect(pan).connect(crowdBus); }
      else src.connect(f).connect(level).connect(crowdBus);
      voices.push({ f, level });
    }
    crowd = { base, voices, tension: 0 };

    setInterval(() => {
      const t = ctx.currentTime;
      crowd.voices.forEach((v) => {
        if (Math.random() < 0.35) {
          v.f.frequency.setTargetAtTime(300 + Math.random() * 1000, t, 0.08);
          v.level.gain.setTargetAtTime(Math.random() < 0.5 ? 0 : (0.05 + Math.random() * 0.12) * (1 + crowd.tension), t, 0.1);
        }
      });
    }, 220);
  }

  // Long rallies make the crowd hold its breath and then get louder
  function tension(amount) {
    if (!ctx || !crowd) return;
    crowd.tension = Math.min(1, amount);
    crowd.base.gain.setTargetAtTime(0.32 + 0.4 * crowd.tension, ctx.currentTime, 0.6);
  }

  function roar(t, peak, hold, from, to) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const f = filter('bandpass', from, 0.8);
    f.frequency.setValueAtTime(from, t);
    f.frequency.linearRampToValueAtTime(to, t + 0.4);
    const env = gain(0, crowdBus);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.25);
    env.gain.setValueAtTime(peak, t + hold);
    env.gain.exponentialRampToValueAtTime(0.001, t + hold + 1.6);
    src.connect(f).connect(env);
    src.start(t);
    src.stop(t + hold + 1.8);
  }

  // Applause: lots of tiny claps spread over a couple of seconds
  function cheer(intensity) {
    if (!ctx) return;
    const k = Math.min(1, Math.max(0.2, intensity));
    const t0 = ctx.currentTime;
    roar(t0, 0.9 * k, 0.6 + k, 500, 1100);
    const claps = Math.floor(90 + 160 * k);
    for (let i = 0; i < claps; i++) {
      const t = t0 + 0.1 + Math.pow(Math.random(), 1.6) * (1.8 + 1.4 * k);
      const dest = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      let out = crowdBus;
      if (dest) { dest.pan.value = Math.random() * 2 - 1; dest.connect(crowdBus); out = dest; }
      burst(out, 'bandpass', 900 + Math.random() * 1800, 1.2, t, 0.012 + Math.random() * 0.02, 0.15 + Math.random() * 0.35);
    }
    // a couple of whistles from the stands
    if (k > 0.5) {
      for (let w = 0; w < 2; w++) {
        const t = t0 + 0.2 + Math.random() * 0.8;
        const out = gain(0.08, crowdBus);
        tone(out, 'sine', 2100, 2900, t, 0.35, 0.5);
        tone(out, 'sine', 2900, 2300, t + 0.4, 0.3, 0.4);
      }
    }
  }

  // "Awww": a disappointed crowd when the opponent scores
  function groan() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const vowel = filter('bandpass', 520, 2.5);
    const out = gain(0, crowdBus);
    vowel.connect(out);
    out.gain.linearRampToValueAtTime(0.35, t + 0.2);
    out.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    for (let i = 0; i < 7; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f = 150 + Math.random() * 90;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 1.4);
      osc.connect(vowel);
      osc.start(t + Math.random() * 0.08);
      osc.stop(t + 1.6);
    }
    roar(t, 0.25, 0.3, 400, 350);
  }

  // "Ooooh!": for a big smash
  function ooh() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const vowel = filter('bandpass', 380, 3);
    const out = gain(0, crowdBus);
    vowel.connect(out);
    out.gain.linearRampToValueAtTime(0.3, t + 0.25);
    out.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    for (let i = 0; i < 7; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f = 170 + Math.random() * 80;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 1.35, t + 0.5);
      osc.frequency.linearRampToValueAtTime(f * 1.1, t + 1.2);
      osc.connect(vowel);
      osc.start(t);
      osc.stop(t + 1.4);
    }
  }

  // ---------------------------------------------------------------- music
  // A quiet synthwave groove in A minor (Am, F, C, G), 112 bpm.
  const BPM = 112;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function scheduleMusic() {
    if (!ctx) return;
    const beat = 60 / BPM / 2; // eighth notes
    while (nextBeat < ctx.currentTime + 0.35) {
      const t = nextBeat;
      const step = beatIndex % 8;
      const chord = CHORDS[Math.floor(beatIndex / 16) % CHORDS.length];

      if (step === 0 && beatIndex % 16 === 0) pad(chord, t, beat * 16);
      if (step === 0 || step === 4) kick(t);
      if (step % 2 === 1) burst(musicBus, 'highpass', 8000, 0.7, t, 0.03, 0.12);
      if (step === 4) burst(musicBus, 'bandpass', 1800, 0.8, t, 0.12, 0.18); // soft snare
      const bassNote = midi(chord[0] - 12);
      tone(musicBus, 'triangle', bassNote, bassNote, t, beat * 0.9, step === 0 ? 0.35 : 0.2);

      nextBeat += beat;
      beatIndex++;
    }
  }

  function pad(chord, t, dur) {
    const lp = filter('lowpass', 1100, 0.5);
    const env = gain(0, musicBus);
    lp.connect(env);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.09, t + 1.2);
    env.gain.setValueAtTime(0.09, t + dur - 1.0);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.3);
    chord.forEach((n) => {
      [-7, 7].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midi(n);
        osc.detune.value = detune;
        osc.connect(lp);
        osc.start(t);
        osc.stop(t + dur + 0.4);
      });
    });
  }

  function kick(t) {
    tone(musicBus, 'sine', 140, 45, t, 0.18, 0.55);
  }

  function setMusic(on) {
    musicOn = on;
    if (ctx) musicBus.gain.setTargetAtTime(on ? 0.2 : 0, ctx.currentTime, 0.3);
  }

  // ---------------------------------------------------------------- announcer
  function speak(text) {
    try {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      const english = voices.find((v) => /en[-_](GB|US)/i.test(v.lang) && /male|daniel|google uk/i.test(v.name))
        || voices.find((v) => /^en/i.test(v.lang));
      if (english) u.voice = english;
      u.rate = 1.02;
      u.pitch = 0.85;
      u.volume = 0.95;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* no speech on this device, that's fine */ }
  }

  return {
    start, setListener, paddle, table, net, floor, whoosh,
    chime, click, cheer, groan, ooh, tension, setMusic, speak,
    get musicOn() { return musicOn; },
  };
})();
