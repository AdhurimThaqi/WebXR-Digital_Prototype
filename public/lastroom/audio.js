// Sound for The Last Room VR. Everything is synthesised live with the
// Web Audio API: no sound files. Browsers only allow audio after a click,
// so LRAudio.start() is called on the first click / Enter VR.

window.LRAudio = (() => {
  let ctx = null;
  let master, reverbIn, musicBus, sfxBus, ambienceBus, noiseBuffer;
  let ambience = null; // the current room's background sounds
  let tune = null;     // the melody that is playing
  let charge = null;   // the rising tone while you hold the trigger
  const listenerPos = new AFRAME.THREE.Vector3();
  const listenerFwd = new AFRAME.THREE.Vector3();
  const listenerUp = new AFRAME.THREE.Vector3();

  // ---------------------------------------------------------------- setup
  function start() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 3;
      compressor.connect(ctx.destination);
      master = gain(0.9, compressor);

      // A big soft room reverb, made from decaying noise
      const reverb = ctx.createConvolver();
      reverb.buffer = impulseResponse(3.2, 2.6);
      reverbIn = gain(1, reverb);
      reverb.connect(master);

      musicBus = bus(0.8, 0.55);
      sfxBus = bus(0.9, 0.25);
      ambienceBus = bus(0.8, 0.12);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      if (pendingAmbience) setAmbience(pendingAmbience.id, pendingAmbience.sounds);
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
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  function noise(loop) {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = !!loop;
    return source;
  }

  function filter(type, frequency, q, destination) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    if (q !== undefined) node.Q.value = q;
    if (destination) node.connect(destination);
    return node;
  }

  // A sound source placed in 3D space, so you hear where it comes from
  function spatial(position, destination) {
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.5;
    panner.rolloffFactor = 1;
    if (panner.positionX) {
      panner.positionX.value = position[0];
      panner.positionY.value = position[1];
      panner.positionZ.value = position[2];
    } else {
      panner.setPosition(position[0], position[1], position[2]);
    }
    panner.connect(destination);
    return panner;
  }

  // Short attack, exponential decay
  function envelope(param, time, attack, peak, decay) {
    param.setValueAtTime(0.0001, time);
    param.exponentialRampToValueAtTime(peak, time + attack);
    param.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  }

  // Called every frame with the headset camera, so 3D sounds follow your head
  function updateListener(camera) {
    if (!ctx) return;
    camera.updateMatrixWorld();
    listenerPos.setFromMatrixPosition(camera.matrixWorld);
    listenerFwd.set(0, 0, -1).transformDirection(camera.matrixWorld);
    listenerUp.set(0, 1, 0).transformDirection(camera.matrixWorld);
    const l = ctx.listener;
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setTargetAtTime(listenerPos.x, t, 0.02);
      l.positionY.setTargetAtTime(listenerPos.y, t, 0.02);
      l.positionZ.setTargetAtTime(listenerPos.z, t, 0.02);
      l.forwardX.setTargetAtTime(listenerFwd.x, t, 0.02);
      l.forwardY.setTargetAtTime(listenerFwd.y, t, 0.02);
      l.forwardZ.setTargetAtTime(listenerFwd.z, t, 0.02);
      l.upX.setTargetAtTime(listenerUp.x, t, 0.02);
      l.upY.setTargetAtTime(listenerUp.y, t, 0.02);
      l.upZ.setTargetAtTime(listenerUp.z, t, 0.02);
    } else {
      l.setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
      l.setOrientation(listenerFwd.x, listenerFwd.y, listenerFwd.z, listenerUp.x, listenerUp.y, listenerUp.z);
    }
  }

  // ---------------------------------------------------------------- sound effects
  function footsteps(count = 4) {
    if (!ctx) return;
    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + 0.1 + i * (0.42 + Math.random() * 0.06);
      const n = noise();
      const g = gain(0, sfxBus);
      n.connect(filter('bandpass', 300 + Math.random() * 120, 0.9)).connect(filter('lowpass', 1400)).connect(g);
      envelope(g.gain, t, 0.006, 0.5, 0.14);
      n.start(t);
      n.stop(t + 0.25);

      const thump = ctx.createOscillator();
      const tg = gain(0, sfxBus);
      thump.frequency.setValueAtTime(95, t);
      thump.frequency.exponentialRampToValueAtTime(55, t + 0.1);
      thump.connect(tg);
      envelope(tg.gain, t, 0.004, 0.35, 0.12);
      thump.start(t);
      thump.stop(t + 0.2);
    }
  }

  function creak(position, volume = 0.18) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const out = position ? spatial(position, sfxBus) : sfxBus;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    for (let i = 1; i <= 8; i++) {
      osc.frequency.linearRampToValueAtTime(120 + Math.random() * 110, t + i * 0.16);
    }
    const g = gain(0, out);
    osc.connect(filter('bandpass', 900, 7)).connect(g);
    osc.connect(filter('bandpass', 1900, 9)).connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.2);
    g.gain.setValueAtTime(volume, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  function doorClose(position) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const out = position ? spatial(position, sfxBus) : sfxBus;
    creak(position, 0.08);

    const thump = ctx.createOscillator();
    const tg = gain(0, out);
    thump.frequency.setValueAtTime(80, t + 1.1);
    thump.frequency.exponentialRampToValueAtTime(45, t + 1.4);
    thump.connect(tg);
    envelope(tg.gain, t + 1.1, 0.005, 0.8, 0.35);
    thump.start(t + 1.1);
    thump.stop(t + 1.6);

    const latch = noise();
    const lg = gain(0, out);
    latch.connect(filter('highpass', 2500)).connect(lg);
    envelope(lg.gain, t + 1.22, 0.002, 0.25, 0.04);
    latch.start(t + 1.2);
    latch.stop(t + 1.35);
  }

  function hover() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.value = 1320;
    const g = gain(0, sfxBus);
    osc.connect(g);
    envelope(g.gain, t, 0.005, 0.025, 0.08);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  function click() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.12);
    const g = gain(0, sfxBus);
    osc.connect(g);
    envelope(g.gain, t, 0.004, 0.08, 0.14);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // A soft rising tone while the trigger is held
  function chargeStart() {
    if (!ctx || charge) return;
    const t = ctx.currentTime;
    const g = gain(0, sfxBus);
    const lp = filter('lowpass', 900, 1, g);
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'triangle';
    oscB.type = 'sine';
    oscA.frequency.value = 220;
    oscB.frequency.value = 330;
    oscA.connect(lp);
    oscB.connect(lp);
    oscA.start(t);
    oscB.start(t);
    g.gain.setTargetAtTime(0.03, t, 0.05);
    charge = { g, lp, oscA, oscB };
  }

  function chargeUpdate(progress) {
    if (!charge) return;
    const t = ctx.currentTime;
    charge.oscA.frequency.setTargetAtTime(220 + 440 * progress, t, 0.03);
    charge.oscB.frequency.setTargetAtTime(330 + 660 * progress, t, 0.03);
    charge.lp.frequency.setTargetAtTime(900 + 2500 * progress, t, 0.03);
    charge.g.gain.setTargetAtTime(0.03 + 0.07 * progress, t, 0.03);
  }

  function chargeStop() {
    if (!charge) return;
    const t = ctx.currentTime;
    const { g, oscA, oscB } = charge;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, 0.05);
    oscA.stop(t + 0.4);
    oscB.stop(t + 0.4);
    charge = null;
  }

  // Sparkly arpeggio when a memory unlocks
  function chime() {
    if (!ctx) return;
    const t = ctx.currentTime;
    ['G5', 'C6', 'E6', 'G6', 'C7'].forEach((note, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq(note);
      const g = gain(0, sfxBus);
      g.connect(gain(0.8, reverbIn));
      osc.connect(g);
      envelope(g.gain, t + i * 0.08, 0.01, 0.06, 1.8);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 2);
    });
  }

  // Paper rustle when the letter unfolds
  function paper() {
    if (!ctx) return;
    for (let i = 0; i < 4; i++) {
      const t = ctx.currentTime + i * (0.09 + Math.random() * 0.08);
      const n = noise();
      const g = gain(0, sfxBus);
      n.connect(filter('bandpass', 2200 + Math.random() * 2000, 0.8)).connect(g);
      envelope(g.gain, t, 0.01, 0.12, 0.08 + Math.random() * 0.12);
      n.start(t, Math.random() * 1.5);
      n.stop(t + 0.3);
    }
  }

  // ---------------------------------------------------------------- room ambience
  let pendingAmbience = null;

  function setAmbience(id, sounds = {}) {
    pendingAmbience = { id, sounds };
    if (!ctx) return;
    stopAmbience();

    const t = ctx.currentTime;
    const out = gain(0, ambienceBus);
    out.gain.setTargetAtTime(1, t, 0.8);
    const room = { out, sources: [], timers: [], memory: false, onMemory: [] };
    ambience = room;

    const loop = (fn, minGap, maxGap) => {
      const run = () => {
        if (ambience !== room) return;
        fn();
        room.timers.push(setTimeout(run, (minGap + Math.random() * (maxGap - minGap)) * 1000));
      };
      room.timers.push(setTimeout(run, Math.random() * minGap * 1000));
    };

    const bed = (type, frequency, level, destination = out) => {
      const n = noise(true);
      const g = gain(level, destination);
      n.connect(filter(type, frequency, 0.7)).connect(g);
      n.start(t, Math.random() * 1.5);
      room.sources.push(n);
      return g;
    };

    const wind = (level) => {
      const n = noise(true);
      const lp = filter('lowpass', 500, 0.6);
      const g = gain(level, out);
      n.connect(lp).connect(g);
      n.start(t, Math.random() * 1.5);
      room.sources.push(n);
      loop(() => {
        const now = ctx.currentTime;
        lp.frequency.setTargetAtTime(250 + Math.random() * 700, now, 1.2);
        g.gain.setTargetAtTime(level * (0.5 + Math.random()), now, 1.5);
      }, 1.5, 3.5);
    };

    const birds = (center, spread, muffled) => {
      const lp = filter('lowpass', muffled ? 1500 : 12000, 0.7, out);
      room.onMemory.push(() => lp.frequency.setTargetAtTime(12000, ctx.currentTime, 1));
      loop(() => {
        const p = [center[0] + (Math.random() - 0.5) * spread, center[1] + Math.random() * 2, center[2] + (Math.random() - 0.5) * spread];
        chirp(p, lp, room.memory ? 0.07 : 0.04);
      }, 1.2, 3.5);
      room.onMemory.push(() => loop(() => chirp([center[0] + (Math.random() - 0.5) * spread, center[1] + 1, center[2]], lp, 0.06), 0.6, 1.6));
    };

    switch (id) {
      case 'intro': {
        [55, 82.4, 110.1].forEach((f, i) => {
          const osc = ctx.createOscillator();
          osc.frequency.value = f;
          const g = gain(0.018 / (i + 1), out);
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.07 + i * 0.03;
          lfo.connect(gain(0.008, g.gain));
          osc.connect(g);
          osc.start(t);
          lfo.start(t);
          room.sources.push(osc, lfo);
        });
        bed('lowpass', 160, 0.05);
        break;
      }
      case 'doorstep':
        wind(0.12);
        bed('bandpass', 3500, 0.012); // leaves
        birds([0, 3, -6], 16, false);
        break;
      case 'hallway':
        bed('lowpass', 140, 0.08);
        loop(() => creak([(Math.random() - 0.5) * 2, 2.6, -1 - Math.random() * 5], 0.03), 7, 14);
        if (sounds.kitchen) {
          // cups and plates clinking in the kitchen, only while the memory plays
          room.onMemory.push(() => loop(() => clink(sounds.kitchen), 0.8, 2.6));
        }
        break;
      case 'kitchen':
        bed('lowpass', 150, 0.07);
        if (sounds.clock) {
          let high = true;
          loop(() => { tick(sounds.clock, high); high = !high; }, 1, 1);
        }
        if (sounds.window) birds(sounds.window, 4, true);
        if (sounds.radio) {
          room.onMemory.push(() => {
            const crackle = gain(0, spatial(sounds.radio, out));
            crackle.gain.setTargetAtTime(0.02, ctx.currentTime, 0.5);
            const n = noise(true);
            n.connect(filter('bandpass', 2500, 0.5)).connect(crackle);
            n.start();
            room.sources.push(n);
          });
        }
        break;
      case 'garden':
        bed('lowpass', 150, 0.06);
        if (sounds.garden) birds(sounds.garden, 10, true);
        room.onMemory.push(() => wind(0.05));
        break;
      case 'bedroom':
        bed('lowpass', 120, 0.05);
        if (sounds.window) {
          const g = bed('lowpass', 380, 0.035, spatial(sounds.window, out));
          loop(() => g.gain.setTargetAtTime(0.02 + Math.random() * 0.04, ctx.currentTime, 2), 3, 6);
        }
        break;
      case 'epilogue':
        wind(0.05);
        loop(() => {
          const angle = Math.random() * Math.PI * 2;
          const distance = 4 + Math.random() * 6;
          cricket([Math.cos(angle) * distance, 0.2, Math.sin(angle) * distance], out);
        }, 0.35, 1.2);
        break;
    }
  }

  function memoryAmbience() {
    if (!ambience || ambience.memory) return;
    ambience.memory = true;
    ambience.onMemory.forEach((fn) => fn());
  }

  function stopAmbience() {
    if (!ambience) return;
    const old = ambience;
    ambience = null;
    const t = ctx.currentTime;
    old.timers.forEach(clearTimeout);
    old.out.gain.cancelScheduledValues(t);
    old.out.gain.setTargetAtTime(0, t, 0.4);
    old.sources.forEach((s) => { try { s.stop(t + 2); } catch (e) {} });
    setTimeout(() => old.out.disconnect(), 2500);
  }

  function chirp(position, destination, volume) {
    const t = ctx.currentTime + 0.02;
    const out = spatial(position, destination);
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < notes; i++) {
      const start = t + i * (0.09 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(base, start);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, start + 0.04);
      osc.frequency.exponentialRampToValueAtTime(base * 0.8, start + 0.1);
      const g = gain(0, out);
      osc.connect(g);
      envelope(g.gain, start, 0.008, volume, 0.1);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  function cricket(position, destination) {
    const t = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    osc.frequency.value = 4200 + Math.random() * 600;
    const g = gain(0, spatial(position, destination));
    osc.connect(g);
    for (let burst = 0; burst < 2; burst++) {
      for (let pulse = 0; pulse < 3; pulse++) {
        const s = t + burst * 0.3 + pulse * 0.055;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.linearRampToValueAtTime(0.03, s + 0.01);
        g.gain.linearRampToValueAtTime(0.0001, s + 0.04);
      }
    }
    osc.start(t);
    osc.stop(t + 0.8);
  }

  function tick(position, high) {
    const t = ctx.currentTime + 0.01;
    const out = spatial(position, ambience ? ambience.out : ambienceBus);
    const osc = ctx.createOscillator();
    osc.frequency.value = high ? 2100 : 1700;
    const g = gain(0, out);
    osc.connect(g);
    envelope(g.gain, t, 0.002, 0.12, 0.025);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  function clink(position) {
    const t = ctx.currentTime + 0.01;
    const out = spatial(position, ambience ? ambience.out : ambienceBus);
    const base = 2400 + Math.random() * 1600;
    [1, 2.7].forEach((mult) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = base * mult;
      const g = gain(0, out);
      osc.connect(g);
      envelope(g.gain, t, 0.002, mult === 1 ? 0.05 : 0.015, 0.35);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // ---------------------------------------------------------------- the tune
  function freq(note) {
    const match = /^([A-G])(#?)(\d)$/.exec(note);
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0);
    const midi = (Number(match[3]) + 1) * 12 + semitones;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // A soft piano / music-box voice
  function piano(time, frequency, beats, beat, velocity, destination, sources) {
    const length = Math.max(beats * beat * 1.6, 1.4);
    const g = gain(0, destination);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(velocity, time + 0.008);
    g.gain.exponentialRampToValueAtTime(velocity * 0.35, time + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, time + length);
    [[1, 1, 'sine'], [2, 0.3, 'sine'], [3, 0.08, 'triangle'], [1.004, 0.35, 'triangle']].forEach(([mult, amp, type]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency * mult;
      osc.connect(gain(amp, g));
      osc.start(time);
      osc.stop(time + length + 0.05);
      sources.push(osc);
    });
  }

  // Warm sustained chord behind the melody
  function pad(time, notes, seconds, volume, destination, sources) {
    const g = gain(0, destination);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(volume, time + seconds * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, time + seconds + 0.6);
    notes.forEach((note) => {
      [-4, 4].forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.frequency.value = freq(note) * 2;
        osc.detune.value = cents;
        osc.connect(g);
        osc.start(time);
        osc.stop(time + seconds + 0.7);
        sources.push(osc);
      });
    });
  }

  function playTune(stageName, sounds = {}) {
    if (!ctx) return;
    stopTune(0.5);
    const song = window.LAST_ROOM.tune;
    const stage = song.stages[stageName];
    const beat = 60 / stage.tempo;
    const sources = [];

    const out = gain(stage.gain, null);
    const lp = filter('lowpass', stage.lowpass, 0.5);
    out.connect(lp);
    if (stage.from && sounds[stage.from]) {
      lp.connect(filter('highpass', 250, 0.5)).connect(spatial(sounds[stage.from], musicBus));
    } else {
      lp.connect(musicBus);
    }

    let time = ctx.currentTime + 0.4;
    const startTime = time;
    stage.phrases.forEach((phraseName, phraseIndex) => {
      const phrase = song.phrases[phraseName];
      const isLast = phraseIndex === stage.phrases.length - 1;
      let bar = 0;
      let beatInBar = 0;
      phrase.notes.forEach(([note, beats]) => {
        if (beatInBar === 0) {
          const chord = song.chords[phrase.chords[bar]];
          if (stage.dropLastBar && bar === 3) return;
          if (stage.bass) piano(time, freq(chord[0]), 3, beat, 0.12, out, sources);
          if (stage.pad) pad(time, chord, 3 * beat, 0.018, out, sources);
        }
        if (!(stage.dropLastBar && bar === 3)) {
          const wobble = stage.wobble ? Math.pow(2, ((Math.random() - 0.5) * stage.wobble) / 1200) : 1;
          const slowEnding = isLast && bar === 3 && stageName === 4 ? 1.3 : 1;
          piano(time, freq(note) * wobble, beats * slowEnding, beat, 0.2, out, sources);
          time += beats * beat * slowEnding;
        }
        beatInBar += beats;
        if (beatInBar >= 3) { beatInBar = 0; bar++; }
      });
    });

    if (stage.swell) {
      out.gain.setValueAtTime(stage.gain * 0.55, startTime);
      out.gain.linearRampToValueAtTime(stage.gain * 1.25, time);
    }
    tune = { out, sources };
  }

  function stopTune(fadeSeconds = 2.5) {
    if (!tune || !ctx) return;
    const { out, sources } = tune;
    tune = null;
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + fadeSeconds);
    sources.forEach((s) => { try { s.stop(t + fadeSeconds + 0.1); } catch (e) {} });
  }

  return {
    start, updateListener,
    footsteps, creak, doorClose, hover, click, chime, paper,
    chargeStart, chargeUpdate, chargeStop,
    setAmbience, memoryAmbience, stopAmbience,
    playTune, stopTune,
    get running() { return !!ctx && ctx.state === 'running'; },
  };
})();
