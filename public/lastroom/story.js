// Story content for the VR version of The Last Room (lastroom.html).
// The texts are copied from src/TheLastRoom.jsx. If you change the story
// there, change it here too.
//
// Extra fields for VR:
//   tuneStage  which version of the tune plays when the memory unlocks
//   vr.panel   where the scene's text panel floats  [x, y, z] (metres, you start at 0 0 0 facing -z)
//   vr.panelScale  size of that panel
//   vr.memoryPanel / vr.memoryScale  (optional) a different spot for the memory text
//   vr.label   where the "hold to remember" ring floats, next to the object
//   vr.sounds  positions that sounds come from

window.LAST_ROOM = {
  scenes: [
    { id: "intro", type: "title" },
    {
      id: "doorstep", sceneNum: "01", title: "The Doorstep", act: "Arrival", mood: "Anticipation",
      description: "You stand outside your grandparent's house for the last time. It is being sold. The garden is overgrown. The door is slightly open.",
      triggerLabel: "The Front Door", triggerHint: "Hold to enter...",
      memory: null, nextScene: "hallway",
      vr: { panel: [-1.35, 1.55, -2.1], panelScale: 1, label: [0, 2.6, -4.6], sounds: { door: [0, 1.2, -5] } },
    },
    {
      id: "hallway", sceneNum: "02", title: "The Hallway", act: "Recognition", mood: "Tender",
      description: "The house is stripped bare. Walls empty. Floors bare. On the coat hook — a single worn cardigan in faded green. The only colour left.",
      triggerLabel: "The Cardigan", triggerHint: "Hold to remember...",
      memory: { text: "The hallway fills again — coats on every hook, shoes piled by the door. Laughter from the kitchen. A figure in that same green cardigan turning to greet you, arms already open.", soundNote: "♪ A distant tune, half-remembered" },
      tuneStage: 1, nextScene: "kitchen",
      // memory text sits lower here, so the figure at the end of the hall stays visible
      vr: { panel: [-0.45, 1.5, -1.9], panelScale: 0.7, memoryPanel: [-0.5, 1.02, -1.8], memoryScale: 0.55, label: [0.55, 1.95, -2.3], sounds: { kitchen: [0, 1.2, -7] } },
    },
    {
      id: "kitchen", sceneNum: "03", title: "The Kitchen", act: "Warmth", mood: "Nostalgic",
      description: "A table. Two chairs. A single teacup, upside down in its saucer. The window shows the garden beyond. Something about this room still feels warm.",
      triggerLabel: "The Teacup", triggerHint: "Hold to remember...",
      memory: { text: "Sunday morning. Radio playing softly. The smell of something baking. A silhouette at the stove, unhurried, humming — the same tune you can almost name but never quite catch.", soundNote: "♪ Piano, slow and simple" },
      tuneStage: 2, nextScene: "garden",
      vr: { panel: [1.2, 1.68, -1.75], panelScale: 0.78, label: [0.15, 1.12, -1.45], sounds: { clock: [-1.35, 2.0, -3.5], radio: [-1.95, 1.05, -2.6], window: [0, 1.6, -4.5] } },
    },
    {
      id: "garden", sceneNum: "04", title: "Through the Glass", act: "Joy", mood: "Bittersweet",
      description: "The living room is completely empty. But the bay window remains. Through it — the overgrown garden, the old bench, the rose bushes gone wild.",
      triggerLabel: "The Garden Window", triggerHint: "Hold to remember...",
      memory: { text: "Summer. A child running through the long grass — that child was you. On the bench, a figure watches, smiling. Unhurried. Content. They have all the time in the world.", soundNote: "♪ The melody swells — complete now" },
      tuneStage: 3, nextScene: "bedroom",
      vr: { panel: [-1.65, 1.55, -1.95], panelScale: 0.9, label: [2.05, 1.5, -3.55], sounds: { garden: [0, 1.5, -9] } },
    },
    {
      id: "bedroom", sceneNum: "05", title: "The Last Room", act: "Love", mood: "Profound",
      description: "The smallest room. A bed frame. A wooden chest at its foot. The lid is slightly open. On top — an envelope. Your name, written in a familiar hand.",
      triggerLabel: "The Letter", triggerHint: "Hold to read...",
      memory: {
        isLetter: true,
        lines: [
          "My dearest,", "Adhurim",
          "If you are reading this, you have come back.", "I knew you would.", "",
          "I want you to know that this house was never", "the important thing.", "You were.", "😊",
          "Every Sunday. Every visit.", "Every time you walked through that door.", "",
          "Take nothing from these walls.", "Take everything from what happened inside them.", "",
          "You always knew where to find me.", "", "You still do.", "",
          "With all my love,", "Gran"
        ],
        soundNote: "♪ The melody, complete and unhurried"
      },
      tuneStage: 4, nextScene: "epilogue",
      vr: { panel: [0.95, 1.5, -1.75], panelScale: 0.75, label: [-0.1, 0.98, -1.05], sounds: { window: [2.2, 1.5, -1.6] } },
    },
    {
      id: "epilogue", sceneNum: "06", title: "Stepping Out", act: "Released", mood: "Peace",
      description: "You are outside again. Evening now. The house stands behind you. The door closes softly — not with finality, but with permission.",
      triggerLabel: null, memory: null, nextScene: "end",
      vr: { panel: [0, 1.6, -2.4], panelScale: 1, sounds: { door: [0.55, 1.2, 9] } },
    },
    { id: "end", type: "end" },
  ],

  // An original, simple waltz (3 beats per bar) in C major.
  // Each note is [pitch, beats]. Each phrase has 4 bars and one chord per bar.
  tune: {
    phrases: {
      A: { notes: [["E4", 1], ["G4", 1], ["A4", 1], ["G4", 2], ["E4", 1], ["D4", 1], ["E4", 1], ["G4", 1], ["E4", 3]], chords: ["C", "C", "G", "C"] },
      B: { notes: [["E4", 1], ["G4", 1], ["A4", 1], ["C5", 2], ["B4", 1], ["A4", 1], ["G4", 1], ["E4", 1], ["D4", 3]], chords: ["C", "Am", "F", "G"] },
      C: { notes: [["C5", 1], ["D5", 1], ["E5", 1], ["D5", 2], ["C5", 1], ["A4", 1], ["C5", 1], ["A4", 1], ["G4", 3]], chords: ["F", "G", "F", "C"] },
      D: { notes: [["E4", 1], ["G4", 1], ["A4", 1], ["G4", 2], ["E4", 1], ["D4", 1], ["E4", 1], ["D4", 1], ["C4", 3]], chords: ["C", "Am", "G", "C"] },
    },
    chords: {
      C: ["C3", "E3", "G3"],
      Am: ["A2", "C3", "E3"],
      F: ["F2", "A2", "C3"],
      G: ["G2", "B2", "D3"],
    },
    // How the tune sounds each time a memory unlocks
    stages: {
      1: { phrases: ["A"], tempo: 70, lowpass: 900, gain: 0.5, wobble: 25, dropLastBar: true, bass: false, pad: false },
      2: { phrases: ["A", "B"], tempo: 76, lowpass: 2600, gain: 0.7, wobble: 6, bass: false, pad: false, from: "radio" },
      3: { phrases: ["A", "B", "C", "D"], tempo: 84, lowpass: 9000, gain: 0.6, wobble: 0, bass: true, pad: true, swell: true },
      4: { phrases: ["A", "B", "C", "D", "D"], tempo: 62, lowpass: 7000, gain: 0.6, wobble: 0, bass: true, pad: true },
      end: { phrases: ["D"], tempo: 56, lowpass: 3500, gain: 0.5, wobble: 0, bass: true, pad: true },
    },
  },
};
