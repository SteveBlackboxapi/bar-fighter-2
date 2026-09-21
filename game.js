/* BAR FIGHTER 2 — arcade-looking local 2P fighter. Gamepad API for Bluetooth pads. */
(() => {
  const W = 480, H = 270, FLOOR = 248, GRAV = 0.55, MAXHP = 100;
  const canvas = document.getElementById("game");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const keys = Object.create(null);
  const keysEdge = Object.create(null);
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
    if (!keys[e.code]) keysEdge[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });

  const padPrev = [{}, {}];
  let p1Pad = -1, p2Pad = -1;

  function shortName(id) {
    if (/dualsense|054c/i.test(id) && /wireless|dualsense/i.test(id)) return "ps5";
    if (/dualshock|054c/i.test(id)) return "ps4";
    if (/xbox|xinput|045e/i.test(id)) return "xbox";
    if (/8bitdo|057e|pro controller|switch/i.test(id)) return "switch/8bitdo";
    return (id || "pad").split(/[:(]/)[0].trim().slice(0, 18).toLowerCase();
  }
  function scanPads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const live = [];
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected) live.push(list[i]);
    if (p1Pad < 0 && live[0]) p1Pad = live[0].index;
    if (p2Pad < 0 && live[1]) p2Pad = live[1].index;
    if (p1Pad >= 0 && (!list[p1Pad] || !list[p1Pad].connected)) p1Pad = live[0] ? live[0].index : -1;
    if (p2Pad >= 0 && (!list[p2Pad] || !list[p2Pad].connected)) p2Pad = live[1] ? live[1].index : -1;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("pads", String(live.length));
    set("p1dev", p1Pad >= 0 && list[p1Pad] ? shortName(list[p1Pad].id) : "keyboard");
    set("p2dev", p2Pad >= 0 && list[p2Pad] ? shortName(list[p2Pad].id) : "keyboard");
  }
  window.addEventListener("gamepadconnected", scanPads);
  window.addEventListener("gamepaddisconnected", scanPads);

  function padState(index) {
    const empty = { left:0,right:0,up:0,down:0,punch:0,kick:0,special:0,start:0,
                    punchEdge:0,kickEdge:0,specialEdge:0,startEdge:0 };
    if (index < 0) return empty;
    const pads = navigator.getGamepads();
    const p = pads && pads[index];
    if (!p) return empty;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const b = (n) => !!(p.buttons[n] && p.buttons[n].pressed);
    const now = {
      left: ax < -0.45 || b(14),
      right: ax > 0.45 || b(15),
      up: ay < -0.5 || b(12),
      down: ay > 0.5 || b(13),
      punch: b(0) || b(2),
      kick: b(1) || b(3),
      special: b(4) || b(5),
      start: b(9) || b(8) || b(16),
    };
    const slot = index === p1Pad ? 0 : 1;
    const prev = padPrev[slot] || {};
    now.punchEdge = now.punch && !prev.punch;
    now.kickEdge = now.kick && !prev.kick;
    now.specialEdge = now.special && !prev.special;
    now.startEdge = now.start && !prev.start;
    padPrev[slot] = { punch: now.punch, kick: now.kick, special: now.special, start: now.start };
    return now;
  }

  const kbMaps = [
    { left:"KeyA", right:"KeyD", up:"KeyW", down:"KeyS", punch:"KeyJ", kick:"KeyK", special:"KeyL", start:"Enter" },
    { left:"ArrowLeft", right:"ArrowRight", up:"ArrowUp", down:"ArrowDown", punch:"Numpad1", kick:"Numpad2", special:"Numpad3", start:"Enter" },
  ];
  const kbAlt2 = { punch:"Comma", kick:"Period", special:"Slash" };

  function readInput(playerIndex) {
    const map = kbMaps[playerIndex];
    const pad = padState(playerIndex === 0 ? p1Pad : p2Pad);
    const alt = playerIndex === 1 ? kbAlt2 : null;
    const down = (code) => !!keys[code];
    const edge = (code) => !!keysEdge[code];
    return {
      left: pad.left || down(map.left),
      right: pad.right || down(map.right),
      up: pad.up || down(map.up),
      down: pad.down || down(map.down),
      punch: pad.punchEdge || edge(map.punch) || (alt && edge(alt.punch)),
      kick: pad.kickEdge || edge(map.kick) || (alt && edge(alt.kick)),
      special: pad.specialEdge || edge(map.special) || (alt && edge(alt.special)),
      start: pad.startEdge || edge(map.start) || edge("Space"),
    };
  }

  const audio = {
    ctx: null,
    beep(freq, dur, type, vol) {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || "square";
        o.frequency.value = freq;
        g.gain.value = vol || 0.06;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch (_) {}
    },
    punch() { this.beep(90, 0.08, "square", 0.08); },
    kick() { this.beep(70, 0.1, "sawtooth", 0.07); },
    special() { this.beep(220, 0.12, "square", 0.05); this.beep(140, 0.18, "triangle", 0.05); },
    hit() { this.beep(50, 0.12, "sawtooth", 0.1); },
    clink() { this.beep(880, 0.08, "square", 0.06); this.beep(1320, 0.12, "triangle", 0.04); },
    ko() { this.beep(110, 0.4, "sawtooth", 0.08); },
    start() { this.beep(330, 0.1, "square", 0.05); this.beep(440, 0.12, "square", 0.05); },
  };

  const ATK = {
    punch: { startup: 5, active: 5, recover: 10, dmg: 8, kb: 2.4, range: 28, tall: 12, y: -38, stun: 10 },
    kick:  { startup: 7, active: 6, recover: 14, dmg: 12, kb: 3.6, range: 34, tall: 12, y: -22, stun: 14 },
  };

  function makeFighter(name, x, facing, pal) {
    return {
      name, x, y: FLOOR, vx: 0, vy: 0, facing, pal,
      hp: MAXHP, grounded: true, crouch: false, stun: 0, flash: 0,
      attack: null, atkT: 0, hitDone: false, specialCD: 0, dead: false, wins: 0,
    };
  }

  const PAL_DUKE = {
    skin:"#e2a06a", skinD:"#c47a48", hair:"#2b1a12", hairL:"#4a2c1c",
    jacket:"#1c1c1e", jacketL:"#3a3a40", shirt:"#111",
    jeans:"#2c3d6a", jeansL:"#3d5288", boot:"#141414", accent:"#e0b24a",
  };
  const PAL_LARK = {
    skin:"#f0c090", skinD:"#d49a62", hair:"#f0c63a", hairL:"#ffe680",
    jacket:"#2a4e9a", jacketL:"#4a72c4", shirt:"#c8d8f0",
    jeans:"#1e3a7a", jeansL:"#2f54a0", boot:"#c03030", accent:"#7ec8ff",
  };

  let state = "title", stateT = 0, timer = 99, timerAcc = 0, winner = null;
  let p1, p2, pints = [], fx = [], shake = 0;

  function resetMatch() {
    p1 = makeFighter("DUKE", 110, 1, PAL_DUKE);
    p2 = makeFighter("LARK", 370, -1, PAL_LARK);
    pints = []; fx = []; timer = 99; timerAcc = 0; winner = null;
  }
  resetMatch();

  function other(f) { return f === p1 ? p2 : p1; }
  function faceEachOther() {
    if (p1.x < p2.x) { p1.facing = 1; p2.facing = -1; }
    else { p1.facing = -1; p2.facing = 1; }
  }
  function startAttack(f, kind) {
    if (f.stun || f.attack || !f.grounded) return;
    f.attack = kind; f.atkT = 0; f.hitDone = false;
    kind === "punch" ? audio.punch() : audio.kick();
  }
  function throwPint(f) {
    if (f.stun || f.attack || f.specialCD > 0) return;
    f.specialCD = 70; f.attack = "special"; f.atkT = 0; f.hitDone = true;
    audio.special();
    pints.push({ x: f.x + f.facing * 20, y: f.y - 42, vx: f.facing * 4.2, vy: -1.4, owner: f, life: 80 });
  }
  function hitbox(f) {
    if (!f.attack || f.attack === "special") return null;
    const a = ATK[f.attack];
    if (f.atkT < a.startup || f.atkT >= a.startup + a.active) return null;
    const x = f.facing === 1 ? f.x + 10 : f.x - 10 - a.range;
    return { x, y: f.y + a.y, w: a.range, h: a.tall, a };
  }
  function bodyBox(f) {
    const h = f.crouch ? 38 : 62;
    return { x: f.x - 12, y: f.y - h, w: 24, h };
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      fx.push({ x, y, vx:(Math.random()-0.5)*3.2, vy:-Math.random()*2.8, life:16+Math.random()*12, color });
    }
  }
  function applyHit(atkF, defF, a, fromPint) {
    if (defF.stun > 8 && !fromPint) return;
    const blocking = defF.grounded && !defF.attack && (
      (defF.facing === 1 && defF._in && defF._in.left) ||
      (defF.facing === -1 && defF._in && defF._in.right)
    );
    const dmg = blocking ? Math.ceil(a.dmg * 0.25) : a.dmg;
    defF.hp = Math.max(0, defF.hp - dmg);
    defF.flash = 6;
    defF.stun = blocking ? 6 : a.stun;
    defF.attack = null;
    defF.vx = atkF.facing * (blocking ? a.kb * 0.3 : a.kb);
    if (!blocking && !defF.grounded) defF.vy = -2.2;
    shake = blocking ? 2 : 7;
    audio.hit();
    burst(defF.x, defF.y - 32, blocking ? "#d0d0d0" : "#ffd24a", blocking ? 5 : 12);
    if (defF.hp <= 0) {
      defF.dead = true; defF.vy = -5; defF.vx = atkF.facing * 3.2;
      winner = atkF; atkF.wins++; state = "ko"; stateT = 0; audio.ko();
    }
  }
  function control(f, input) {
    f._in = input;
    if (state !== "fight" || f.dead) return;
    if (f.stun > 0) { f.stun--; return; }
    if (f.specialCD > 0) f.specialCD--;
    if (f.attack) {
      f.atkT++;
      const a = ATK[f.attack];
      const rec = f.attack === "special" ? 16 : a.startup + a.active + a.recover;
      if (f.atkT >= rec) f.attack = null;
      return;
    }
    f.crouch = f.grounded && input.down;
    if (f.crouch) { f.vx *= 0.55; return; }
    const spd = 2.05;
    if (input.left) f.vx = -spd;
    else if (input.right) f.vx = spd;
    else f.vx *= 0.68;
    if (input.up && f.grounded) { f.vy = -8.2; f.grounded = false; }
    if (input.punch) startAttack(f, "punch");
    else if (input.kick) startAttack(f, "kick");
    else if (input.special) throwPint(f);
  }
  function physics(f) {
    f.vy += GRAV; f.x += f.vx; f.y += f.vy;
    if (f.x < 22) { f.x = 22; f.vx = 0; }
    if (f.x > W - 22) { f.x = W - 22; f.vx = 0; }
    if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; f.grounded = true; if (f.dead) f.vx *= 0.8; }
    else f.grounded = false;
    if (f.flash > 0) f.flash--;
  }
  function collideFighters() {
    const gap = 20;
    if (Math.abs(p1.x - p2.x) < gap && Math.abs(p1.y - p2.y) < 50) {
      const mid = (p1.x + p2.x) / 2;
      if (p1.x < p2.x) { p1.x = mid - gap / 2; p2.x = mid + gap / 2; }
      else { p1.x = mid + gap / 2; p2.x = mid - gap / 2; }
    }
  }
  function resolveHits() {
    for (const f of [p1, p2]) {
      const hb = hitbox(f);
      if (!hb || f.hitDone) continue;
      const o = other(f);
      if (overlap(hb, bodyBox(o))) { f.hitDone = true; applyHit(f, o, hb.a, false); }
    }
    for (const pint of pints) {
      if (pint.life <= 0) continue;
      if (overlap({ x:pint.x-5, y:pint.y-5, w:10, h:10 }, bodyBox(other(pint.owner)))) {
        pint.life = 0;
        applyHit(pint.owner, other(pint.owner), { dmg:16, kb:4.2, stun:16 }, true);
        burst(pint.x, pint.y, "#f4d27a", 14);
      }
    }
  }
  function stepPints() {
    for (const pint of pints) {
      pint.x += pint.vx; pint.vy += 0.14; pint.y += pint.vy; pint.life--;
      if (pint.y > FLOOR - 4) { pint.life = 0; burst(pint.x, FLOOR - 2, "#c45a2a", 8); }
    }
    pints = pints.filter((p) => p.life > 0);
    for (const p of fx) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
    fx = fx.filter((p) => p.life > 0);
  }

  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect((x)|0, (y)|0, w, h); }
  function neon(text, x, y, color) {
    ctx.save();
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
  function drawBar() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2a1814");
    g.addColorStop(0.45, "#3a221a");
    g.addColorStop(1, "#1a0e0a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    px(0, 0, W, 18, "#1a100c");
    for (let x = 20; x < W; x += 80) px(x, 0, 10, 26, "#2a1810");
    px(8, 22, W - 16, 78, "#4a2c20");
    px(10, 24, W - 20, 74, "#3a2218");
    px(70, 30, 340, 28, "#160e0a");
    px(70, 56, 340, 3, "#6a4430");
    for (let i = 0; i < 16; i++) {
      const bx = 78 + i * 20;
      const col = i % 4 === 0 ? "#7a2030" : i % 4 === 1 ? "#2a5088" : i % 4 === 2 ? "#d4a84a" : "#3a7a4a";
      px(bx, 34, 7, 18, col);
      px(bx + 1, 34, 5, 4, "#fff8");
    }
    neon("COLD BEER", 16, 36, "#ff3a5a");
    neon("LIVE", 424, 36, "#3ad0ff");
    px(228, 62, 22, 8, "#e2a06a");
    px(230, 58, 18, 6, "#1a1a1a");
    px(226, 70, 26, 22, "#2a2420");
    px(232, 74, 14, 10, "#c4b8a0");
    px(24, 88, 432, 10, "#8a5a32");
    px(24, 98, 432, 6, "#5a341c");
    px(24, 88, 432, 2, "#c49058");
    for (const sx of [48, 88, 380, 420]) {
      px(sx, 104, 14, 3, "#8a5a32");
      px(sx + 6, 107, 2, 14, "#4a3018");
    }
    drawPatron(52, 86, "#5a3030", "#d09070");
    drawPatron(92, 86, "#2a3858", "#e0b080");
    drawPatron(384, 86, "#3a2a4a", "#d0a070");
    drawPatron(424, 86, "#2a4a38", "#c09060");
    px(6, 118, 28, 70, "#1a2030");
    px(10, 124, 20, 16, "#3a80ff");
    px(12, 146, 6, 4, "#ff3355");
    px(20, 146, 6, 4, "#ffe14a");
    px(446, 120, 28, 68, "#3a1520");
    px(450, 126, 20, 22, "#6a2040");
    px(452, 130, 6, 6, "#ff5a7a");
    px(460, 130, 6, 6, "#5ad0ff");
    px(452, 140, 16, 4, "#ffe14a");
    px(0, FLOOR, W, H - FLOOR, "#6a4428");
    px(0, FLOOR, W, 3, "#2a1810");
    for (let x = 0; x < W; x += 20) px(x, FLOOR + 8, 12, 2, "#5a381e");
    ctx.fillStyle = "#b0502088";
    ctx.beginPath();
    ctx.ellipse(240, FLOOR + 1, 36, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawPatron(x, y, shirt, skin) {
    px(x, y - 16, 12, 8, skin);
    px(x + 2, y - 18, 8, 4, "#1a1a1a");
    px(x, y - 8, 12, 12, shirt);
  }
  function drawFighter(f) {
    const p = f.pal;
    const dir = f.facing;
    const punchOn = f.attack === "punch" && f.atkT >= 5 && f.atkT < 12;
    const kickOn = f.attack === "kick" && f.atkT >= 7 && f.atkT < 14;
    const bob = f.grounded && !f.attack && !f.crouch && !f.dead ? ((stateT >> 3) % 2) : 0;
    let y = f.y + bob;
    if (f.crouch) y += 12;
    if (f.dead) y += 8;
    if (f.flash && stateT % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#00000099";
    ctx.beginPath();
    ctx.ellipse(f.x, FLOOR + 2, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const hx = f.x | 0;
    const legH = f.crouch ? 16 : 26;
    const legY = y - legH;
    px(hx - 9, legY, 8, legH, p.jeans);
    px(hx + 1, legY, 8, legH, p.jeans);
    px(hx - 8, legY, 3, legH, p.jeansL);
    px(hx + 2, legY, 3, legH, p.jeansL);
    px(hx - 10, y - 4, 10, 4, p.boot);
    px(hx, y - 4, 10, 4, p.boot);
    if (kickOn) {
      px(hx + dir * 6, y - 22, 22, 8, p.jeans);
      px(hx + dir * 6, y - 22, 22, 2, p.jeansL);
      px(hx + dir * 24, y - 22, 8, 8, p.boot);
    }
    const th = f.crouch ? 22 : 30;
    const ty = y - legH - th;
    px(hx - 12, ty, 24, th, p.jacket);
    px(hx - 11, ty + 2, 4, th - 4, p.jacketL);
    px(hx - 4, ty + 6, 8, th - 10, p.skin);
    px(hx - 3, ty + 8, 6, 10, p.shirt);
    px(hx - 11, ty + th - 5, 22, 4, "#1a1a1a");
    px(hx - 2, ty + th - 4, 4, 3, "#d4a84a");
    const backArmX = hx - dir * 13;
    px(backArmX, ty + 4, 7, 16, p.jacket);
    px(backArmX + (dir === 1 ? 0 : 3), ty + 18, 5, 5, p.skin);
    const reach = punchOn ? 20 : 13;
    const armX = hx + dir * reach;
    px(hx + dir * 8, ty + (punchOn ? 2 : 6), Math.abs(armX - (hx + dir * 8)), 8, p.jacket);
    px(armX - 3, ty + (punchOn ? 0 : 12), 7, 7, p.skin);
    if (punchOn) px(armX + dir * 2, ty - 1, 6, 6, p.skinD);
    const hy = ty - 16;
    px(hx - 9, hy, 18, 16, p.skin);
    px(hx - 8, hy + 12, 16, 3, p.skinD);
    if (f.name === "LARK") {
      px(hx - 10, hy - 6, 20, 8, p.hair);
      px(hx - 8, hy - 8, 16, 4, p.hairL);
      px(hx + (dir === 1 ? 6 : -10), hy - 2, 6, 10, p.hair);
    } else {
      px(hx - 10, hy - 4, 20, 8, p.hair);
      px(hx - 9, hy - 2, 6, 12, p.hair);
      px(hx + 3, hy - 2, 6, 8, p.hair);
    }
    const eyeX = hx + dir * 4;
    px(eyeX, hy + 5, 2, 2, "#111");
    px(eyeX + dir, hy + 5, 1, 1, "#fff");
    px(hx + dir * 2, hy + 10, 5, 2, "#a04030");
    if (f.stun) px(hx - 2, hy + 8, 5, 2, "#a04030");
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.accent;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(f.name, f.x, f.y + 12);
    ctx.textAlign = "left";
  }
  function drawPint(x, y, scale) {
    const s = scale || 1;
    px(x - 5 * s, y - 12 * s, 10 * s, 12 * s, "#e8b44a");
    px(x - 4 * s, y - 10 * s, 8 * s, 8 * s, "#f0d080");
    px(x - 6 * s, y - 13 * s, 12 * s, 4 * s, "#fff4d0");
    px(x + 5 * s, y - 10 * s, 3 * s, 6 * s, "#d0d8e8");
  }
  function drawHUD() {
    function mug(align, hp, name, color) {
      const w = 150;
      const filled = Math.max(0, (hp / MAXHP) * w);
      if (align === "left") {
        px(28, 10, w + 6, 14, "#140c08");
        px(30, 12, filled, 10, color);
        px(30 + filled, 12, w - filled, 10, "#3a2010");
        px(30, 12, w, 3, "#fff2");
        ctx.fillStyle = "#f4e6c3";
        ctx.font = "bold 9px monospace";
        ctx.fillText(name, 30, 9);
        drawPint(16, 22, 1);
      } else {
        px(W - 34 - w, 10, w + 6, 14, "#140c08");
        px(W - 32 - filled, 12, filled, 10, color);
        px(W - 32 - w, 12, w - filled, 10, "#3a2010");
        ctx.fillStyle = "#f4e6c3";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "right";
        ctx.fillText(name, W - 30, 9);
        ctx.textAlign = "left";
        drawPint(W - 16, 22, 1);
      }
    }
    mug("left", p1.hp, "DUKE", "#e0b24a");
    mug("right", p2.hp, "LARK", "#7ec8ff");
    px(218, 6, 44, 16, "#140c08");
    ctx.fillStyle = "#ffd24a";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(timer).padStart(2, "0"), 240, 18);
    ctx.textAlign = "left";
  }
  function banner(text, y, color, size) {
    ctx.textAlign = "center";
    ctx.font = "bold " + (size || 22) + "px monospace";
    ctx.fillStyle = "#000";
    ctx.fillText(text, 241, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, 240, y);
    ctx.textAlign = "left";
  }
  function drawTitle() {
    drawBar();
    ctx.fillStyle = "#0007";
    ctx.fillRect(0, 0, W, H);
    banner("BAR FIGHTER 2", 78, "#ff3a5a", 28);
    banner("WORLD WARRIOR OF THE STICKY FLOOR", 98, "#ffd24a", 10);
    if ((stateT >> 4) % 2 === 0) banner("PRESS START  /  ENTER", 150, "#f4e6c3", 12);
    banner("PAIR PADS, THEN PRESS A BUTTON IN THIS TAB", 232, "#9a7a4a", 8);
    drawFighter({ ...p1, x: 120, y: FLOOR, attack: null, crouch: false, flash: 0, facing: 1, grounded: true, dead: false });
    drawFighter({ ...p2, x: 360, y: FLOOR, attack: null, crouch: false, flash: 0, facing: -1, grounded: true, dead: false });
  }
  function drawBump() {
    drawBar();
    const t = stateT;
    const walk = Math.min(t, 48);
    const d1 = makeFighter("DUKE", 50 + walk * 2.0, 1, PAL_DUKE);
    const d2 = makeFighter("LARK", 430 - walk * 2.0, -1, PAL_LARK);
    d1.grounded = d2.grounded = true;
    drawFighter(d1); drawFighter(d2);
    if (t > 48) {
      drawPint(240 + Math.sin(t * 0.4) * 10, FLOOR - 16 - (t - 48) * 0.7, 1.6);
      banner("HEY  WATCH IT", 70, "#f4e6c3", 16);
    }
  }
  function drawCheers() {
    drawBar();
    drawFighter(p1); drawFighter(p2);
    const t = Math.min(stateT, 42);
    const k = t / 42;
    const gx = 50 + k * 150;
    drawPint(gx, 110, 3.2);
    drawPint(W - gx, 110, 3.2);
    if (t > 28) banner("ROUND 1", 58, "#ffd24a", 26);
    if (t > 36) banner("FIGHT", 168, "#ff3a5a", 32);
  }
  function drawKO() {
    drawBar();
    drawFighter(p1); drawFighter(p2);
    for (const pint of pints) drawPint(pint.x, pint.y, 1.2);
    drawHUD();
    ctx.fillStyle = "#0007";
    ctx.fillRect(0, 90, W, 60);
    banner("K.O.", 128, "#ff3a5a", 36);
    banner((winner ? winner.name : "NOBODY") + "  WINS", 150, "#ffd24a", 14);
    if (stateT > 80) banner("START  TO  REMATCH", 200, "#f4e6c3", 12);
  }
  function frame() {
    scanPads();
    const i1 = readInput(0);
    const i2 = readInput(1);
    const start = i1.start || i2.start;
    if (state === "title") {
      stateT++;
      if (start) { audio.start(); state = "bump"; stateT = 0; resetMatch(); }
      drawTitle();
    } else if (state === "bump") {
      stateT++;
      if (stateT === 50) audio.hit();
      drawBump();
      if (stateT > 95 || start) { state = "cheers"; stateT = 0; audio.clink(); }
    } else if (state === "cheers") {
      stateT++;
      if (stateT === 30) audio.clink();
      drawCheers();
      if (stateT > 75) { state = "fight"; stateT = 0; }
    } else if (state === "fight") {
      stateT++;
      timerAcc++;
      if (timerAcc >= 60) { timerAcc = 0; timer = Math.max(0, timer - 1); }
      if (timer === 0 && !winner) {
        winner = p1.hp === p2.hp ? null : (p1.hp > p2.hp ? p1 : p2);
        if (winner) winner.wins++;
        state = "ko"; stateT = 0; audio.ko();
      }
      faceEachOther();
      control(p1, i1); control(p2, i2);
      physics(p1); physics(p2);
      collideFighters(); resolveHits(); stepPints();
      if (shake > 0) shake--;
      ctx.save();
      if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBar();
      drawFighter(p1); drawFighter(p2);
      for (const pint of pints) drawPint(pint.x, pint.y, 1.3);
      for (const p of fx) px(p.x, p.y, 2, 2, p.color);
      drawHUD();
      ctx.restore();
    } else if (state === "ko") {
      stateT++;
      physics(p1); physics(p2); stepPints();
      drawKO();
      if (stateT > 80 && start) { resetMatch(); state = "bump"; stateT = 0; }
    }
    for (const k of Object.keys(keysEdge)) keysEdge[k] = false;
    requestAnimationFrame(frame);
  }
  scanPads();
  requestAnimationFrame(frame);
})();
