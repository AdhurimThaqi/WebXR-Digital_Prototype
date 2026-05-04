import { useState, useEffect, useRef, useCallback } from "react";

const SCENES = [
  { id: "intro", type: "title" },
  {
    id: "doorstep", sceneNum: "01", title: "The Doorstep", act: "Arrival", mood: "Anticipation",
    description: "You stand outside your grandparent's house for the last time. It is being sold. The garden is overgrown. The door is slightly open.",
    triggerLabel: "The Front Door", triggerHint: "Hold to enter...",
    memory: null, bg: "doorstep", nextScene: "hallway",
  },
  {
    id: "hallway", sceneNum: "02", title: "The Hallway", act: "Recognition", mood: "Tender",
    description: "The house is stripped bare. Walls empty. Floors bare. On the coat hook — a single worn cardigan in faded green. The only colour left.",
    triggerLabel: "The Cardigan", triggerHint: "Hold to remember...",
    memory: { text: "The hallway fills again — coats on every hook, shoes piled by the door. Laughter from the kitchen. A figure in that same green cardigan turning to greet you, arms already open.", soundNote: "♪ A distant tune, half-remembered" },
    bg: "hallway", nextScene: "kitchen",
  },
  {
    id: "kitchen", sceneNum: "03", title: "The Kitchen", act: "Warmth", mood: "Nostalgic",
    description: "A table. Two chairs. A single teacup, upside down in its saucer. The window shows the garden beyond. Something about this room still feels warm.",
    triggerLabel: "The Teacup", triggerHint: "Hold to remember...",
    memory: { text: "Sunday morning. Radio playing softly. The smell of something baking. A silhouette at the stove, unhurried, humming — the same tune you can almost name but never quite catch.", soundNote: "♪ Piano, slow and simple" },
    bg: "kitchen", nextScene: "garden",
  },
  {
    id: "garden", sceneNum: "04", title: "Through the Glass", act: "Joy", mood: "Bittersweet",
    description: "The living room is completely empty. But the bay window remains. Through it — the overgrown garden, the old bench, the rose bushes gone wild.",
    triggerLabel: "The Garden Window", triggerHint: "Hold to remember...",
    memory: { text: "Summer. A child running through the long grass — that child was you. On the bench, a figure watches, smiling. Unhurried. Content. They have all the time in the world.", soundNote: "♪ The melody swells — complete now" },
    bg: "garden", nextScene: "bedroom",
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
    bg: "bedroom", nextScene: "epilogue",
  },
  {
    id: "epilogue", sceneNum: "06", title: "Stepping Out", act: "Released", mood: "Peace",
    description: "You are outside again. Evening now. The house stands behind you. The door closes softly — not with finality, but with permission.",
    triggerLabel: null, memory: null, bg: "epilogue", nextScene: "end",
  },
];

// ── BACKGROUNDS ────────────────────────────────────────────────────────────────
function SceneBG({ bg, memoryActive }) {
  const abs = { position: "absolute", inset: 0 };

  if (bg === "doorstep") return (
    <div style={{ ...abs, background: "linear-gradient(180deg,#c4a882 0%,#b0c0cc 35%,#6b7f6e 68%,#4a5c42 100%)" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"19%", background:"#4a5c42" }} />
      <div style={{ position:"absolute", bottom:"17%", left:"50%", transform:"translateX(-50%)", width:"52%", height:"52%", background:"#c8b99a", borderRadius:"4px 4px 0 0", boxShadow:"0 0 60px rgba(0,0,0,.3)" }}>
        <div style={{ position:"absolute", top:"-20%", left:"-10%", right:"-10%", height:"24%", background:"#7a6652", clipPath:"polygon(0 100%,50% 0,100% 100%)" }} />
        {[{l:"10%",t:"20%"},{l:"62%",t:"20%"}].map((w,i)=>(
          <div key={i} style={{ position:"absolute", left:w.l, top:w.t, width:"26%", height:"30%", background:"#e8d5a3", border:"3px solid #8b7355" }}>
            <div style={{ position:"absolute", left:"48%", top:0, bottom:0, width:"3px", background:"#8b7355" }} />
            <div style={{ position:"absolute", top:"48%", left:0, right:0, height:"3px", background:"#8b7355" }} />
          </div>
        ))}
        <div style={{ position:"absolute", bottom:0, left:"36%", width:"28%", height:"44%", background:"#4a3028", borderRadius:"50% 50% 0 0/25% 25% 0 0", border:"2px solid #3d2b1f" }}>
          <div style={{ position:"absolute", top:"30%", right:"15%", width:"10%", height:"10%", borderRadius:"50%", background:"#c9973a" }} />
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,rgba(255,200,100,.22) 0%,transparent 40%)", borderRadius:"inherit" }} />
        </div>
      </div>
      <div style={{ position:"absolute", bottom:"9%", left:"43%", width:"14%", height:"11%", background:"#9a8a72", clipPath:"polygon(20% 0,80% 0,100% 100%,0 100%)" }} />
      <div style={{ position:"absolute", bottom:"19%", right:"13%", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ width:40, height:26, background:"#d4431a", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:2 }}>
          <span style={{ color:"white", fontSize:5, fontWeight:"bold" }}>FOR SALE</span>
        </div>
        <div style={{ width:4, height:20, background:"#5c4033" }} />
      </div>
      {[...Array(14)].map((_,i)=>(
        <div key={i} style={{ position:"absolute", bottom:"17%", left:`${4+i*7}%`, width:2, height:12+Math.sin(i)*5, background:"#4a6b3a", borderRadius:"50% 50% 0 0", transform:`rotate(${-12+Math.sin(i*2.3)*18}deg)`, transformOrigin:"bottom" }} />
      ))}
      {memoryActive && <div style={{ position:"absolute", inset:0, background:"rgba(200,150,80,.22)", transition:"all 1.2s" }} />}
    </div>
  );

  if (bg === "hallway") return (
    <div style={{ ...abs, background:"linear-gradient(180deg,#d4ccc0 0%,#b8b0a4 100%)" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"32%", background:"#9a9080" }} />
      <div style={{ position:"absolute", top:0, bottom:0, left:0, width:"18%", background:"rgba(0,0,0,.1)" }} />
      <div style={{ position:"absolute", top:0, bottom:0, right:0, width:"18%", background:"rgba(0,0,0,.12)" }} />
      <div style={{ position:"absolute", top:"4%", left:"50%", transform:"translateX(-50%)", width:3, height:"12%" }}>
        <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:32, height:32, borderRadius:"50%", background:"#e8d5a0", boxShadow:`0 0 ${memoryActive?70:28}px #e8d080`, transition:"box-shadow 1s" }} />
      </div>
      <div style={{ position:"absolute", top:"48%", left:"48%", width:"5%", height:"14%", background:"#f0e0a0", boxShadow:"0 0 40px 18px rgba(240,224,160,.35)" }} />
      <div style={{ position:"absolute", top:"22%", right:"22%", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ width:44, height:8, background:"#5c4033", borderRadius:3, position:"relative" }}>
          <div style={{ position:"absolute", right:12, top:7, width:5, height:14, background:"#5c4033", borderRadius:"0 0 4px 4px", transform:"rotate(-15deg)" }} />
        </div>
        <div style={{ marginTop:6, width:64, height:76, background:memoryActive?"#6b9a5a":"#5a7a4a", borderRadius:"30% 30% 10% 10%", boxShadow:memoryActive?"0 0 34px rgba(100,200,80,.7)":"0 4px 15px rgba(0,0,0,.3)", transition:"all .6s", position:"relative" }}>
          <div style={{ position:"absolute", top:"40%", left:-22, width:24, height:42, background:memoryActive?"#6b9a5a":"#5a7a4a", borderRadius:"0 0 10px 10px", transform:"rotate(-10deg)", transition:"background .6s" }} />
          <div style={{ position:"absolute", top:"40%", right:-22, width:24, height:42, background:memoryActive?"#6b9a5a":"#5a7a4a", borderRadius:"0 0 10px 10px", transform:"rotate(10deg)", transition:"background .6s" }} />
          <div style={{ position:"absolute", inset:4, backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 4px,rgba(255,255,255,.1) 4px,rgba(255,255,255,.1) 5px)" }} />
        </div>
      </div>
      {memoryActive && <div style={{ position:"absolute", inset:0, background:"rgba(180,120,40,.18)", transition:"all 1.2s" }} />}
    </div>
  );

  if (bg === "kitchen") return (
    <div style={{ ...abs, background:"linear-gradient(180deg,#e8dcc8 0%,#d4c8b0 100%)" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"28%", background:"#b0a090" }} />
      <div style={{ position:"absolute", top:"6%", left:"28%", width:"44%", height:"38%", background:memoryActive?"#f0c060":"#c8e0d0", border:"8px solid #8b7355", transition:"background 1.2s", boxShadow:memoryActive?"0 0 80px rgba(240,180,60,.5)":"none" }}>
        <div style={{ position:"absolute", left:"48%", top:0, bottom:0, width:6, background:"#8b7355" }} />
        <div style={{ position:"absolute", top:"48%", left:0, right:0, height:6, background:"#8b7355" }} />
      </div>
      <div style={{ position:"absolute", bottom:"25%", left:"22%", width:"56%", height:"5%", background:"#7a6040", borderRadius:3, boxShadow:"0 4px 15px rgba(0,0,0,.3)" }}>
        <div style={{ position:"absolute", bottom:"100%", left:"4%", width:5, height:"180%", background:"#6a5030" }} />
        <div style={{ position:"absolute", bottom:"100%", right:"4%", width:5, height:"180%", background:"#6a5030" }} />
      </div>
      {[18,67].map((l,i)=>(
        <div key={i} style={{ position:"absolute", bottom:"28%", left:`${l}%`, width:"13%", display:"flex", flexDirection:"column", alignItems:"center" }}>
          {/* Chair back */}
          <div style={{ width:"80%", height:52, background:"#6a5030", borderRadius:"6px 6px 0 0", border:"2px solid #8a6a48", borderBottom:"none", marginBottom:0 }} />
          {/* Chair seat */}
          <div style={{ width:"100%", height:10, background:"#7a5a38", borderRadius:3, border:"2px solid #8a6a48", boxShadow:"0 2px 6px rgba(0,0,0,.3)" }} />
          {/* Chair legs */}
          <div style={{ width:"100%", display:"flex", justifyContent:"space-between", paddingLeft:3, paddingRight:3 }}>
            <div style={{ width:4, height:28, background:"#5c4028", borderRadius:"0 0 2px 2px" }} />
            <div style={{ width:4, height:28, background:"#5c4028", borderRadius:"0 0 2px 2px" }} />
          </div>
        </div>
      ))}
      {/* Teacup on table — right way up */}
      <div style={{ position:"absolute", bottom:"36%", left:"47%", display:"flex", flexDirection:"column", alignItems:"center", filter:memoryActive?"drop-shadow(0 0 18px rgba(255,200,80,.9))":"none", transition:"filter .5s" }}>
        {/* Cup body */}
        <div style={{ width:28, height:22, background:"#e8d0b0", borderRadius:"4px 4px 12px 12px", border:"1px solid #c8b090", position:"relative" }}>
          {/* Handle */}
          <div style={{ position:"absolute", top:"20%", right:-10, width:10, height:12, borderRadius:"0 6px 6px 0", border:"2px solid #c8b090", borderLeft:"none", background:"transparent" }} />
          {/* Floral detail */}
          <div style={{ position:"absolute", top:"30%", left:"28%", width:6, height:6, borderRadius:"50%", background:"#c8a0b0", opacity:.55 }} />
        </div>
        {/* Saucer */}
        <div style={{ marginTop:-2, width:40, height:7, background:"#e8d0b0", borderRadius:"50%", border:"1px solid #c8b090" }} />
      </div>
      <div style={{ position:"absolute", top:"18%", right:"13%", width:3, height:"62%", background:"#8b7355", opacity:.5 }}>
        {[30,46,62,76,90].map((t,i)=>(
          <div key={i}>
            <div style={{ position:"absolute", top:`${t}%`, left:3, width:12, height:1, background:"#5c4033" }} />
            <div style={{ position:"absolute", top:`${t-4}%`, left:16, fontSize:6, color:"#5c4033", fontFamily:"Georgia", whiteSpace:"nowrap" }}>{["'92","'94","'97","'99","'02"][i]}</div>
          </div>
        ))}
      </div>
      {memoryActive && <div style={{ position:"absolute", inset:0, background:"rgba(180,100,20,.16)", transition:"all 1.2s" }} />}
    </div>
  );

  if (bg === "garden") return (
    <div style={{ ...abs, background:"linear-gradient(180deg,#c8d4dc 0%,#a8b8c0 40%,#8a9880 100%)" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"32%", background:"#9a9488" }} />
      <div style={{ position:"absolute", top:0, bottom:0, left:0, width:"14%", background:"rgba(0,0,0,.14)" }} />
      <div style={{ position:"absolute", top:0, bottom:0, right:0, width:"14%", background:"rgba(0,0,0,.16)" }} />
      <div style={{ position:"absolute", top:"8%", left:"18%", right:"18%", height:"56%", border:"10px solid #8b7355", overflow:"hidden", boxShadow:memoryActive?"0 0 100px rgba(135,206,235,.5)":"0 0 30px rgba(200,220,240,.2)", transition:"box-shadow 1.2s" }}>
        <div style={{ position:"absolute", left:"33%", top:0, bottom:0, width:6, background:"#8b7355" }} />
        <div style={{ position:"absolute", left:"66%", top:0, bottom:0, width:6, background:"#8b7355" }} />
        <div style={{ position:"absolute", top:"48%", left:0, right:0, height:6, background:"#8b7355" }} />
        <div style={{ position:"absolute", inset:0, background:memoryActive?"linear-gradient(180deg,#87ceeb 0%,#b8e4b8 55%,#5a9a4a 100%)":"linear-gradient(180deg,#a8c0c8 0%,#88a888 55%,#4a6a3a 100%)", transition:"background 1.2s" }}>
          {[10,26,68,82].map((l,i)=>(
            <div key={i} style={{ position:"absolute", bottom:"15%", left:`${l}%`, width:"13%", height:"32%", background:memoryActive?"#5a9a4a":"#3a6a2a", borderRadius:"50% 50% 20% 20%", transition:"background 1.2s" }}>
              {memoryActive && [0,1,2].map(j=><div key={j} style={{ position:"absolute", top:`${20+j*22}%`, left:`${10+j*18}%`, width:9, height:9, borderRadius:"50%", background:["#ff6b88","#ff9a8a","#ffb3c6"][j], opacity:.85 }} />)}
            </div>
          ))}
          <div style={{ position:"absolute", bottom:"25%", left:"54%", width:"22%", height:"13%", background:memoryActive?"#8b6b40":"#5a4020", transition:"background 1.2s" }}>
            <div style={{ position:"absolute", top:"-60%", left:0, right:0, height:"60%", background:"inherit", borderRadius:"3px 3px 0 0" }} />
          </div>
          {memoryActive && <>
            <div style={{ position:"absolute", bottom:"32%", left:"28%", opacity:.7 }}>
              <div style={{ width:10, height:10, background:"#5c3a1a", borderRadius:"50%", margin:"0 auto" }} />
              <div style={{ width:12, height:18, background:"#5c3a1a", borderRadius:"4px 4px 0 0", margin:"0 auto" }} />
            </div>
            <div style={{ position:"absolute", bottom:"31%", left:"56%", opacity:.65 }}>
              <div style={{ width:10, height:10, background:"#5c3a1a", borderRadius:"50%", margin:"0 auto" }} />
              <div style={{ width:14, height:20, background:"#5c3a1a", borderRadius:"4px 4px 0 0", margin:"0 auto" }} />
            </div>
          </>}
          {[...Array(14)].map((_,i)=>(
            <div key={i} style={{ position:"absolute", bottom:"12%", left:`${i*7.5}%`, width:2, height:9+Math.sin(i)*5, background:memoryActive?"#5ab44a":"#3a6a2a", borderRadius:"50% 50% 0 0", transform:`rotate(${-8+Math.sin(i*1.8)*15}deg)`, transformOrigin:"bottom", transition:"background 1.2s" }} />
          ))}
        </div>
      </div>
    </div>
  );

  if (bg === "bedroom") return (
    <div style={{ ...abs, background:"linear-gradient(180deg,#c0b4a8 0%,#a89890 100%)" }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"30%", background:"#8a7868" }} />
      <div style={{ position:"absolute", top:"7%", right:"18%", width:"16%", height:"22%", background:"#8ab4c8", border:"5px solid #8b7355" }}>
        <div style={{ position:"absolute", left:"48%", top:0, bottom:0, width:3, background:"#8b7355" }} />
        <div style={{ position:"absolute", top:"48%", left:0, right:0, height:3, background:"#8b7355" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,rgba(200,180,150,.4) 0%,transparent 30%,transparent 70%,rgba(200,180,150,.4) 100%)" }} />
      </div>
      <div style={{ position:"absolute", bottom:"28%", left:"14%", width:"46%", height:"6%", background:"#5c4033" }}>
        <div style={{ position:"absolute", bottom:"100%", left:0, right:0, height:"200%", background:"#5c4033", borderRadius:"8px 8px 0 0" }}>
          <div style={{ position:"absolute", inset:"10%", border:"3px solid #7a5a44", borderRadius:"4px 4px 0 0" }} />
        </div>
        <div style={{ position:"absolute", bottom:"-90%", left:"2%", width:"4%", height:"90%", background:"#4a3028" }} />
        <div style={{ position:"absolute", bottom:"-90%", right:"2%", width:"4%", height:"90%", background:"#4a3028" }} />
      </div>
      <div style={{ position:"absolute", bottom:"29%", left:"37%", width:"18%", height:"9%", background:"#6a4a30", border:"2px solid #8a6a48", boxShadow:"0 4px 20px rgba(0,0,0,.4)", borderRadius:2 }}>
        <div style={{ position:"absolute", top:"-22%", left:0, right:0, height:"26%", background:"#7a5a38", borderRadius:"2px 2px 0 0", transform:"rotate(-5deg)", transformOrigin:"bottom left" }} />
        <div style={{ position:"absolute", top:"18%", left:"44%", width:"12%", height:"28%", background:"#c9973a", borderRadius:2 }} />
        <div style={{ position:"absolute", top:"-38%", left:"8%", width:"84%", height:"32%", background:"#f0e8d0", borderRadius:1, boxShadow:memoryActive?"0 0 35px rgba(255,220,100,1)":"0 0 12px rgba(255,220,100,.6)", transition:"box-shadow .5s" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:"55%", background:"#e8d8c0", clipPath:"polygon(0 0,50% 100%,100% 0)" }} />
        </div>
      </div>
      {memoryActive && <div style={{ position:"absolute", inset:0, background:"rgba(160,100,30,.18)", transition:"all 1.2s" }} />}
    </div>
  );

  if (bg === "epilogue") return (
    <div style={{ ...abs, background:"linear-gradient(180deg,#1a2040 0%,#3a4a7a 25%,#8a5a3a 55%,#c4703a 70%,#d4906a 85%,#3a3020 100%)" }}>
      {[...Array(22)].map((_,i)=>(
        <div key={i} style={{ position:"absolute", top:`${3+Math.random()*45}%`, left:`${Math.random()*100}%`, width:2, height:2, background:"white", borderRadius:"50%", opacity:Math.random()*.8+.1 }} />
      ))}
      <div style={{ position:"absolute", bottom:"34%", left:"50%", transform:"translateX(-50%)", width:"54%", height:"38%", background:"#12121e" }}>
        <div style={{ position:"absolute", top:"-22%", left:"-9%", right:"-9%", height:"26%", background:"#0e0e18", clipPath:"polygon(0 100%,50% 0,100% 100%)" }} />
        <div style={{ position:"absolute", bottom:0, left:"36%", width:"28%", height:"44%", background:"#080810", borderRadius:"50% 50% 0 0/25% 25% 0 0" }} />
        {[{l:"11%",t:"20%"},{l:"62%",t:"20%"}].map((w,i)=>(
          <div key={i} style={{ position:"absolute", left:w.l, top:w.t, width:"25%", height:"29%", background:"#f0c060", opacity:.55, boxShadow:"0 0 20px rgba(240,192,96,.4)" }} />
        ))}
      </div>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"36%", background:"linear-gradient(180deg,#3a3020 0%,#1e1a10 100%)" }} />
      <div style={{ position:"absolute", bottom:"9%", left:"43%", width:"14%", height:"26%", background:"#5a4a38", clipPath:"polygon(15% 0,85% 0,100% 100%,0 100%)" }} />
    </div>
  );

  return <div style={{ ...abs, background:"#0d0c0a" }} />;
}

// ── GAZE TRIGGER ──────────────────────────────────────────────────────────────
function GazeTrigger({ label, hint, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);
  const progressRef = useRef(0);
  const doneRef = useRef(false);

  const startHold = (e) => {
    e.preventDefault();
    if (doneRef.current) return;
    setHolding(true);
    timerRef.current = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 2.5, 100);
      setProgress(progressRef.current);
      if (progressRef.current >= 100) {
        clearInterval(timerRef.current);
        doneRef.current = true;
        setDone(true);
        setHolding(false);
        setTimeout(onComplete, 400);
      }
    }, 30);
  };

  const stopHold = (e) => {
    if (e) e.preventDefault();
    if (doneRef.current) return;
    clearInterval(timerRef.current);
    setHolding(false);
    progressRef.current = 0;
    setProgress(0);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const R = 30, circ = 2 * Math.PI * R;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, userSelect:"none" }}>
      <div
        onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold}
        onTouchStart={startHold} onTouchEnd={stopHold} onTouchCancel={stopHold}
        style={{ cursor:done?"default":"pointer", position:"relative", width:76, height:76, touchAction:"none" }}
      >
        <svg width={76} height={76} style={{ position:"absolute", inset:0, transform:"rotate(-90deg)" }}>
          <circle cx={38} cy={38} r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={3} />
          <circle cx={38} cy={38} r={R} fill="none"
            stroke={done?"#c9973a":holding?"#e8c870":"rgba(201,151,58,.65)"}
            strokeWidth={3.5} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ*(1-progress/100)}
            style={{ transition:"stroke .3s" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:done?22:holding?16:9, height:done?22:holding?16:9, borderRadius:"50%", background:done?"#c9973a":holding?"rgba(232,210,130,.9)":"rgba(255,255,255,.55)", transition:"all .25s", boxShadow:holding?"0 0 18px rgba(232,200,100,.7)":"none" }} />
        </div>
      </div>
      <div style={{ textAlign:"center", pointerEvents:"none" }}>
        <div style={{ color:done?"rgba(201,151,58,.9)":"rgba(255,255,255,.85)", fontSize:13, fontFamily:"'Playfair Display',Georgia,serif", transition:"color .3s" }}>
          {done ? "✓ Memory unlocked" : label}
        </div>
        <div style={{ color:"rgba(201,151,58,.7)", fontSize:11, fontFamily:"Georgia,serif", fontStyle:"italic", marginTop:3 }}>
          {done?"":holding?"Hold...":hint}
        </div>
      </div>
    </div>
  );
}

// ── LETTER ────────────────────────────────────────────────────────────────────
function LetterReveal({ lines, onDone }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    if (countRef.current >= lines.length) { onDone(); return; }
    const delay = lines[countRef.current] === "" ? 240 : 520;
    const t = setTimeout(() => {
      countRef.current += 1;
      setCount(countRef.current);
    }, delay);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div style={{ fontFamily:"'Playfair Display',Georgia,serif", padding:"26px 30px", background:"rgba(245,236,215,.97)", borderRadius:2, maxWidth:340, width:"100%", boxShadow:"0 10px 50px rgba(0,0,0,.55)", maxHeight:"65vh", overflowY:"auto", position:"relative" }}>
      {[...Array(16)].map((_,i)=><div key={i} style={{ position:"absolute", left:22, right:22, top:44+i*24, height:1, background:"rgba(160,130,80,.1)" }} />)}
      <div style={{ position:"relative" }}>
        {lines.slice(0, count).map((line,i)=>(
          <div key={i} style={{ minHeight:"1.55em", fontSize:i===0?15:13, color:i===0?"#3a2a10":"#4a3820", lineHeight:1.65, fontStyle:i===0?"italic":"normal", marginBottom:line===""?4:0 }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MEMORY OVERLAY ────────────────────────────────────────────────────────────
function MemoryOverlay({ memory, onContinue }) {
  const [visible, setVisible] = useState(false);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 60);
    const t2 = !memory.isLetter ? setTimeout(() => setCanContinue(true), 1400) : null;
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, []);

  const go = () => { setVisible(false); setTimeout(onContinue, 550); };

  return (
    <div style={{ position:"absolute", inset:0, zIndex:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, background:`rgba(8,6,4,${visible?.78:0})`, transition:"background .6s" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18, maxWidth:500, width:"100%", transform:`translateY(${visible?0:20}px)`, opacity:visible?1:0, transition:"all .7s ease" }}>

        {!memory.isLetter ? (<>
          <div style={{ width:36, height:1, background:"rgba(201,151,58,.5)" }} />
          <p style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"clamp(13px,2.5vw,16px)", color:"rgba(238,220,186,.95)", textAlign:"center", lineHeight:1.85, fontStyle:"italic", margin:0 }}>
            {memory.text}
          </p>
          <div style={{ color:"rgba(201,151,58,.65)", fontSize:12, fontFamily:"Georgia,serif", fontStyle:"italic" }}>{memory.soundNote}</div>
          <div style={{ width:36, height:1, background:"rgba(201,151,58,.5)" }} />
          {canContinue && (
            <button onClick={go} style={{ fontFamily:"'Playfair Display',serif", fontSize:12, letterSpacing:"2px", textTransform:"uppercase", color:"rgba(201,151,58,.9)", background:"transparent", border:"1px solid rgba(201,151,58,.45)", padding:"13px 34px", cursor:"pointer", borderRadius:1, transition:"all .3s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,151,58,.1)";e.currentTarget.style.borderColor="rgba(201,151,58,.8)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(201,151,58,.45)"}}>
              Continue →
            </button>
          )}
        </>) : (<>
          <div style={{ fontSize:10, letterSpacing:"3px", color:"rgba(201,151,58,.65)", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>A letter for you</div>
          <LetterReveal lines={memory.lines} onDone={() => setCanContinue(true)} />
          {canContinue && (
            <button onClick={go} style={{ fontFamily:"'Playfair Display',serif", fontSize:12, letterSpacing:"2px", textTransform:"uppercase", color:"rgba(201,151,58,.9)", background:"transparent", border:"1px solid rgba(201,151,58,.45)", padding:"13px 34px", cursor:"pointer", borderRadius:1, transition:"all .3s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,151,58,.1)";e.currentTarget.style.borderColor="rgba(201,151,58,.8)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(201,151,58,.45)"}}>
              Continue →
            </button>
          )}
        </>)}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [memoryActive, setMemoryActive] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [triggerDone, setTriggerDone] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const scene = SCENES[sceneIdx];

  const advance = useCallback(() => {
    if (transitioning) return;
    if (scene.nextScene === "end") { setShowEnd(true); return; }
    setTransitioning(true);
    setTimeout(() => {
      setSceneIdx(SCENES.findIndex(s => s.id === scene.nextScene));
      setMemoryActive(false); setShowMemory(false); setTriggerDone(false); setTransitioning(false);
    }, 650);
  }, [transitioning, scene]);

  const onTrigger = useCallback(() => {
    setTriggerDone(true);
    if (scene.memory) { setMemoryActive(true); setTimeout(() => setShowMemory(true), 600); }
    else { setTimeout(advance, 600); }
  }, [scene, advance]);

  const onMemoryContinue = useCallback(() => {
    setShowMemory(false); setMemoryActive(false); setTimeout(advance, 300);
  }, [advance]);

  const restart = () => { setSceneIdx(0); setMemoryActive(false); setShowMemory(false); setTriggerDone(false); setShowEnd(false); setTransitioning(false); };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
    @keyframes fadeInUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.85}}
    *{box-sizing:border-box} body{margin:0}
  `;

  // TITLE
  if (scene.type === "title") return (<>
    <style>{css}</style>
    <div style={{ width:"100%", height:"100vh", background:"radial-gradient(ellipse at 50% 60%,#1a1408 0%,#0d0c0a 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
      {[...Array(18)].map((_,i)=><div key={i} style={{ position:"absolute", top:`${Math.random()*100}%`, left:`${Math.random()*100}%`, width:1, height:1, background:"rgba(201,151,58,.5)", borderRadius:"50%", animation:`twinkle ${2+Math.random()*3}s ease-in-out infinite`, animationDelay:`${Math.random()*4}s` }} />)}
      <div style={{ textAlign:"center", padding:"0 28px", maxWidth:520 }}>
        <div style={{ fontFamily:"'EB Garamond',Georgia,serif", fontSize:11, letterSpacing:"5px", color:"rgba(201,151,58,.65)", textTransform:"uppercase", marginBottom:22, animation:"fadeInUp 1s ease .2s both" }}>A Narrative Experience</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(42px,10vw,70px)", fontWeight:700, color:"#f0e8d0", lineHeight:1.08, marginBottom:16, textShadow:"0 2px 40px rgba(201,151,58,.25)", animation:"fadeInUp 1s ease .4s both" }}>The Last Room</div>
        <div style={{ width:50, height:1, background:"rgba(201,151,58,.45)", margin:"18px auto", animation:"fadeInUp 1s ease .6s both" }} />
        <div style={{ fontFamily:"'EB Garamond',Georgia,serif", fontSize:"clamp(14px,2.5vw,17px)", color:"rgba(200,180,148,.78)", fontStyle:"italic", lineHeight:1.8, marginBottom:42, animation:"fadeInUp 1s ease .8s both" }}>
          You are stepping back into your grandparent's home<br/>for the last time. It is being sold.<br/>Most things are gone. But some rooms still remember.
        </div>
        <button onClick={()=>setSceneIdx(1)} style={{ fontFamily:"'Playfair Display',serif", fontSize:12, letterSpacing:"2.5px", textTransform:"uppercase", color:"rgba(201,151,58,.88)", background:"transparent", border:"1px solid rgba(201,151,58,.38)", padding:"14px 40px", cursor:"pointer", borderRadius:1, transition:"all .3s", animation:"fadeInUp 1s ease 1s both" }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,151,58,.08)";e.currentTarget.style.borderColor="rgba(201,151,58,.75)"}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(201,151,58,.38)"}}>
          Enter the House
        </button>
        <div style={{ marginTop:16, fontFamily:"Georgia,serif", fontSize:10, color:"rgba(255,255,255,.18)", letterSpacing:"1px", animation:"fadeInUp 1s ease 1.2s both" }}>
          Hold the trigger object in each room to unlock a memory
        </div>
      </div>
      <div style={{ position:"absolute", bottom:18, fontFamily:"Georgia,serif", fontSize:9, color:"rgba(255,255,255,.18)", letterSpacing:"2px", textTransform:"uppercase" }}>CreaLab · HSLU · I.BA_LAB_INIS.F26 · Digital Prototype</div>
    </div>
  </>);

  // END SCREEN
  if (showEnd) return (<>
    <style>{css}</style>
    <div style={{ width:"100%", height:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:"0 40px", animation:"fadeInUp 2s ease both" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(15px,3vw,21px)", color:"rgba(238,220,186,.82)", fontStyle:"italic", lineHeight:2.1, marginBottom:36 }}>
          "You always knew where to find me.<br/>You still do."
        </div>
        <div style={{ width:36, height:1, background:"rgba(201,151,58,.45)", margin:"0 auto 26px" }} />
        <div style={{ fontFamily:"Georgia,serif", fontSize:11, color:"rgba(255,255,255,.22)", letterSpacing:"2.5px", textTransform:"uppercase", marginBottom:28 }}>End of Experience</div>
        <button onClick={restart} style={{ fontFamily:"'Playfair Display',serif", fontSize:11, letterSpacing:"2px", color:"rgba(201,151,58,.7)", background:"transparent", border:"1px solid rgba(201,151,58,.3)", padding:"11px 28px", cursor:"pointer", borderRadius:1, transition:"all .3s" }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(201,151,58,.7)"}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(201,151,58,.3)"}}>
          Begin Again
        </button>
      </div>
    </div>
  </>);

  // MAIN SCENE
  return (<>
    <style>{css}</style>
    <div style={{ width:"100%", height:"100vh", position:"relative", overflow:"hidden", background:"#0d0c0a" }}>

      <div style={{ position:"absolute", inset:0, opacity:transitioning?0:1, transition:"opacity .65s ease" }}>
        <SceneBG bg={scene.bg} memoryActive={memoryActive} />
      </div>

      {/* vignette */}
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,.62) 100%)", pointerEvents:"none", zIndex:2 }} />

      {/* memory overlay */}
      {showMemory && scene.memory && <MemoryOverlay memory={scene.memory} onContinue={onMemoryContinue} />}

      {/* header */}
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"18px 22px", display:"flex", justifyContent:"space-between", zIndex:5, pointerEvents:"none" }}>
        <div style={{ animation:"fadeIn .8s ease" }}>
          <div style={{ fontSize:10, letterSpacing:"3px", color:"rgba(201,151,58,.68)", textTransform:"uppercase", marginBottom:4, fontFamily:"Georgia,serif" }}>Scene {scene.sceneNum} — {scene.act}</div>
          <div style={{ fontSize:19, fontWeight:600, color:"rgba(240,232,210,.92)", fontFamily:"'Playfair Display',serif", textShadow:"0 1px 12px rgba(0,0,0,.6)" }}>{scene.title}</div>
        </div>
        <div style={{ fontSize:10, letterSpacing:"2px", color:"rgba(255,255,255,.22)", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>{scene.mood}</div>
      </div>

      {/* description */}
      {!triggerDone && !showMemory && (
        <div style={{ position:"absolute", bottom:170, left:"50%", transform:"translateX(-50%)", width:"88%", maxWidth:500, textAlign:"center", zIndex:5, pointerEvents:"none", animation:"fadeInUp .8s ease .3s both" }}>
          <p style={{ fontFamily:"'EB Garamond',Georgia,serif", fontSize:"clamp(13px,2.5vw,15px)", color:"rgba(208,192,165,.88)", fontStyle:"italic", lineHeight:1.85, margin:0, textShadow:"0 1px 18px rgba(0,0,0,.85)" }}>
            {scene.description}
          </p>
        </div>
      )}

      {/* controls */}
      <div style={{ position:"absolute", bottom:36, left:"50%", transform:"translateX(-50%)", zIndex:5, display:"flex", flexDirection:"column", alignItems:"center", gap:14, animation:"fadeInUp .8s ease .5s both" }}>
        {scene.triggerLabel && !triggerDone && (
          <GazeTrigger label={scene.triggerLabel} hint={scene.triggerHint} onComplete={onTrigger} />
        )}
        {scene.id === "epilogue" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
            <p style={{ fontFamily:"'EB Garamond',serif", fontSize:15, color:"rgba(198,180,152,.8)", fontStyle:"italic", margin:0, textAlign:"center", textShadow:"0 1px 12px rgba(0,0,0,.8)" }}>The door closes softly behind you.</p>
            <button onClick={advance} style={{ fontFamily:"'Playfair Display',serif", fontSize:12, letterSpacing:"2px", color:"rgba(201,151,58,.85)", background:"transparent", border:"1px solid rgba(201,151,58,.35)", padding:"12px 30px", cursor:"pointer", borderRadius:1, transition:"all .3s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(201,151,58,.08)";e.currentTarget.style.borderColor="rgba(201,151,58,.7)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="rgba(201,151,58,.35)"}}>
              Step Away →
            </button>
          </div>
        )}
      </div>

      {/* dots */}
      <div style={{ position:"absolute", bottom:18, right:18, display:"flex", gap:6, zIndex:5 }}>
        {SCENES.filter(s=>s.sceneNum).map(s=>(
          <div key={s.id} style={{ width:5, height:5, borderRadius:"50%", background:s.id===scene.id?"rgba(201,151,58,.9)":"rgba(255,255,255,.2)", transition:"all .4s" }} />
        ))}
      </div>

      <div style={{ position:"absolute", bottom:18, left:16, fontFamily:"Georgia,serif", fontSize:9, color:"rgba(255,255,255,.16)", letterSpacing:"1.5px", textTransform:"uppercase", zIndex:5 }}>CreaLab · Digital Prototype</div>
    </div>
  </>);
}
