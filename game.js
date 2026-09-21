/* BAR FIGHTER 2 — local 2P canvas fighter. Bluetooth pads via Gamepad API. */
(() => {
  const W = 384, H = 216, FLOOR = 186, GRAV = 0.45, MAXHP = 100;
  const canvas = document.getElementById("game");
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
  let padCount = 0;
  let p1Pad = -1, p2Pad = -1;

  function scanPads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const live = [];
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].connected) live.push(list[i]);
    padCount = live.length;
    if (p1Pad < 0 && live[0]) p1Pad = live[0].index;
    if (p2Pad < 0 && live[1]) p2Pad = live[1].index;
    if (p1Pad >= 0 && (!list[p1Pad] || !list[p1Pad].connected)) p1Pad = live[0] ? live[0].index : -1;
    if (p2Pad >= 0 && (!list[p2Pad] || !list[p2Pad].connected)) p2Pad = live[1] ? live[1].index : -1;
    const el = document.getElementById("pads");
    if (el) el.textContent = String(padCount);
    const p1el = document.getElementById("p1dev");
    const p2el = document.getElementById("p2dev");
    if (p1el) p1el.textContent = p1Pad >= 0 && list[p1Pad] ? shortName(list[p1Pad].id) : "keyboard";
    if (p2el) p2el.textContent = p2Pad >= 0 && list[p2Pad] ? shortName(list[p2Pad].id) : "keyboard";
  }
  function shortName(id) {
    if (/dualsense|wireless controller/i.test(id) && /054c/i.test(id)) return "ps5";
    if (/dualshock|054c/i.test(id)) return "ps4";
    if (/xbox|xinput|045e/i.test(id)) return "xbox";
    if (/8bitdo|057e|pro controller|switch/i.test(id)) return "switch/8bitdo";
    return (id || "pad").split(/[:(]/)[0].trim().slice(0, 18).toLowerCase();
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
    punch: { startup: 5, active: 5, recover: 10, dmg: 8, kb: 2.2, range: 22, tall: 10, y: -28, stun: 10 },
    kick:  { startup: 7, active: 6, recover: 14, dmg: 12, kb: 3.4, range: 28, tall: 10, y: -16, stun: 14 },
  };

  function makeFighter(name, x, facing, palette) {
    return {
      name, x, y: FLOOR, vx: 0, vy: 0, facing,
      hp: MAXHP, palette,
      grounded: true, crouch: false, stun: 0, flash: 0,
      attack: null, atkT: 0, hitDone: false,
      specialCD: 0, dead: false, wins: 0,
    };
  }

  let state = "title";
  let stateT = 0;
  let timer = 99;
  let timerAcc = 0;
  let winner = null;
  let p1, p2;
  let pints = [];
  let fx = [];
  let shake = 0;

  function resetMatch() {
    p1 = makeFighter("DUKE", 90, 1, { jacket:"#1a1a1a", skin:"#e0a070", hair:"#2a1a10", jeans:"#2a3f70", accent:"#c9a24a" });
    p2 = makeFighter("LARK", 294, -1, { jacket:"#3a5a9a", skin:"#f0c090", hair:"#e8c040", jeans:"#2a4a8a", accent:"#6ec0ff" });
    pints = [];
    fx = [];
    timer = 99;
    timerAcc = 0;
    winner = null;
  }
  resetMatch();

  function other(f) { return f === p1 ? p2 : p1; }

  function faceEachOther() {
    if (p1.x < p2.x) { p1.facing = 1; p2.facing = -1; }
    else { p1.facing = -1; p2.facing = 1; }
  }

  function startAttack(f, kind) {
    if (f.stun || f.attack || !f.grounded) return;
    f.attack = kind;
    f.atkT = 0;
    f.hitDone = false;
    if (kind === "punch") audio.punch();
    else audio.kick();
  }

  function throwPint(f) {
    if (f.stun || f.attack || f.specialCD > 0) return;
    f.specialCD = 70;
    f.attack = "special";
    f.atkT = 0;
    f.hitDone = true;
    audio.special();
    pints.push({
      x: f.x + f.facing * 16,
      y: f.y - 30,
      vx: f.facing * 3.6,
      vy: -1.2,
      owner: f,
      life: 80,
    });
  }

  function hitbox(f) {
    if (!f.attack || f.attack === "special") return null;
    const a = ATK[f.attack];
    if (f.atkT < a.startup || f.atkT >= a.startup + a.active) return null;
    const x = f.facing === 1 ? f.x + 8 : f.x - 8 - a.range;
    return { x, y: f.y + a.y, w: a.range, h: a.tall, a };
  }

  function bodyBox(f) {
    const h = f.crouch ? 28 : 48;
    return { x: f.x - 10, y: f.y - h, w: 20, h };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
    if (!blocking && !defF.grounded) defF.vy = -2;
    shake = blocking ? 2 : 6;
    audio.hit();
    burst(defF.x, defF.y - 24, blocking ? "#c0c0c0" : "#ffcc55", blocking ? 4 : 10);
    if (defF.hp <= 0) {
      defF.dead = true;
      defF.vy = -4;
      defF.vx = atkF.facing * 3;
      winner = atkF;
      atkF.wins++;
      state = "ko";
      stateT = 0;
      audio.ko();
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      fx.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2.5,
        life: 18 + Math.random() * 10,
        color,
      });
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
    if (f.crouch) { f.vx *= 0.6; return; }

    const spd = 1.7;
    if (input.left) f.vx = -spd;
    else if (input.right) f.vx = spd;
    else f.vx *= 0.7;

    if (input.up && f.grounded) {
      f.vy = -7.2;
      f.grounded = false;
    }
    if (input.punch) startAttack(f, "punch");
    else if (input.kick) startAttack(f, "kick");
    else if (input.special) throwPint(f);
  }

  function physics(f) {
    f.vy += GRAV;
    f.x += f.vx;
    f.y += f.vy;
    if (f.x < 18) { f.x = 18; f.vx = 0; }
    if (f.x > W - 18) { f.x = W - 18; f.vx = 0; }
    if (f.y >= FLOOR) {
      f.y = FLOOR;
      f.vy = 0;
      f.grounded = true;
      if (f.dead) f.vx *= 0.8;
    } else f.grounded = false;
    if (f.flash > 0) f.flash--;
  }

  function collideFighters() {
    const gap = 16;
    if (Math.abs(p1.x - p2.x) < gap && Math.abs(p1.y - p2.y) < 40) {
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
      if (overlap(hb, bodyBox(o))) {
        f.hitDone = true;
        applyHit(f, o, hb.a, false);
      }
    }
    for (const pint of pints) {
      if (pint.life <= 0) continue;
      const box = { x: pint.x - 4, y: pint.y - 4, w: 8, h: 8 };
      const victim = other(pint.owner);
      if (overlap(box, bodyBox(victim))) {
        pint.life = 0;
        applyHit(pint.owner, victim, { dmg: 16, kb: 4, stun: 16 }, true);
        burst(pint.x, pint.y, "#f4d27a", 12);
      }
    }
  }

  function stepPints() {
    for (const pint of pints) {
      pint.x += pint.vx;
      pint.vy += 0.12;
      pint.y += pint.vy;
      pint.life--;
      if (pint.y > FLOOR - 4) { pint.life = 0; burst(pint.x, FLOOR - 2, "#c45a2a", 8); }
    }
    pints = pints.filter((p) => p.life > 0);
    for (const p of fx) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
    fx = fx.filter((p) => p.life > 0);
  }

  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x|0, y|0, w, h); }

  function drawBar() {
    ctx.fillStyle = "#2a1510";
    ctx.fillRect(0, 0, W, H);
    px(0, 0, W, 120, "#3a2218");
    px(0, 70, W, 50, "#2c1a12");
    px(40, 28, 304, 36, "#1a100c");
    for (let i = 0; i < 14; i++) {
      const bx = 48 + i * 21;
      px(bx, 32, 6, 14, i % 3 === 0 ? "#6a2030" : i % 3 === 1 ? "#2a5080" : "#c9a24a");
      px(bx + 1, 32, 4, 4, "#fff6");
    }
    px(40, 62, 304, 3, "#5a3a22");
    ctx.fillStyle = "#ff3355";
    ctx.font = "8px monospace";
    ctx.fillText("COLD BEER", 16, 22);
    ctx.fillStyle = "#44ddff";
    ctx.fillText("LIVE", 330, 22);
    px(180, 78, 24, 28, "#1e1a18");
    px(186, 70, 12, 10, "#e0a070");
    px(188, 68, 8, 3, "#1a1a1a");
    px(184, 106, 8, 14, "#2a2a40");
    px(192, 106, 8, 14, "#2a2a40");
    px(20, 118, 344, 8, "#6a4024");
    px(20, 126, 344, 6, "#3a2214");
    for (const sx of [50, 90, 280, 320]) {
      px(sx, 132, 12, 3, "#8a5a30");
      px(sx + 5, 135, 2, 16, "#4a3018");
    }
    drawDude(58, 148, "#4a2a2a", "#c08060");
    drawDude(96, 148, "#2a3a5a", "#e0b080");
    drawDude(278, 148, "#3a2a4a", "#d0a070");
    drawDude(316, 148, "#2a4a3a", "#c09060");
    px(0, FLOOR, W, H - FLOOR, "#5a3a22");
    px(0, FLOOR, W, 2, "#2a1810");
    for (let x = 0; x < W; x += 16) px(x, FLOOR + 8, 10, 1, "#4a3018");
    ctx.fillStyle = "#c45a2a88";
    ctx.beginPath();
    ctx.ellipse(192, FLOOR - 1, 28, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDude(x, y, shirt, skin) {
    const s = 0.7;
    px(x, y - 22 * s, 10 * s, 8 * s, skin);
    px(x, y - 14 * s, 10 * s, 14 * s, shirt);
  }

  function drawFighter(f) {
    const p = f.palette;
    const dir = f.facing;
    const bob = f.grounded && !f.attack && !f.crouch ? ((stateT >> 3) % 2) : 0;
    let y = f.y + bob;
    if (f.crouch) y += 10;
    if (f.flash && (stateT % 2 === 0)) ctx.globalAlpha = 0.45;

    ctx.fillStyle = "#0008";
    ctx.beginPath();
    ctx.ellipse(f.x, FLOOR + 1, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const hx = f.x;
    const legY = y - (f.crouch ? 14 : 20);
    px(hx - 7, legY, 6, f.crouch ? 14 : 20, p.jeans);
    px(hx + 1, legY, 6, f.crouch ? 14 : 20, p.jeans);
    px(hx - 8, y - 2, 7, 3, "#111");
    px(hx + 1, y - 2, 7, 3, "#111");

    const ty = y - (f.crouch ? 30 : 42);
    px(hx - 9, ty, 18, f.crouch ? 18 : 24, p.jacket);
    px(hx - 4, ty + 6, 8, 10, p.skin);

    const punchOn = f.attack === "punch" && f.atkT >= 5 && f.atkT < 12;
    const kickOn = f.attack === "kick" && f.atkT >= 7 && f.atkT < 14;
    const armX = hx + dir * (punchOn ? 14 : 10);
    px(hx - dir * 10, ty + 4, 6, 12, p.jacket);
    px(armX - 3, ty + (punchOn ? 2 : 6), 6, 12, p.jacket);
    px(armX + dir * 2, ty + (punchOn ? 0 : 14), 5, 5, p.skin);

    if (kickOn) {
      px(hx + dir * 8, y - 16, 16, 6, p.jeans);
      px(hx + dir * 22, y - 16, 5, 5, "#111");
    }

    const hy = ty - 12;
    px(hx - 7, hy, 14, 13, p.skin);
    px(hx - 7, hy - 4, 14, 6, p.hair);
    if (dir === 1) {
      px(hx + 3, hy + 4, 2, 2, "#111");
      px(hx + 2, hy + 8, 4, 1, "#a04030");
    } else {
      px(hx - 5, hy + 4, 2, 2, "#111");
      px(hx - 6, hy + 8, 4, 1, "#a04030");
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = p.accent;
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    ctx.fillText(f.name, f.x, f.y + 10);
    ctx.textAlign = "left";
  }

  function drawPint(x, y, scale, foam) {
    const s = scale || 1;
    px(x - 4 * s, y - 10 * s, 8 * s, 10 * s, "#e8b84a");
    px(x - 5 * s, y - 11 * s, 10 * s, 3 * s, foam ? "#fff4d0" : "#f0d080");
    px(x + 4 * s, y - 8 * s, 3 * s, 5 * s, "#d0d8e0");
  }

  function drawHUD() {
    function mug(align, hp, name, color) {
      const w = 120;
      const filled = Math.max(0, (hp / MAXHP) * w);
      if (align === "left") {
        px(20, 8, w + 8, 12, "#1a1008");
        px(22, 10, filled, 8, color);
        px(22 + filled, 10, w - filled, 8, "#3a2010");
        ctx.fillStyle = "#f4e6c3";
        ctx.font = "7px monospace";
        ctx.fillText(name, 22, 7);
        drawPint(14, 18, 1, true);
      } else {
        px(W - 28 - w, 8, w + 8, 12, "#1a1008");
        px(W - 26 - filled, 10, filled, 8, color);
        px(W - 26 - w, 10, w - filled, 8, "#3a2010");
        ctx.fillStyle = "#f4e6c3";
        ctx.font = "7px monospace";
        ctx.textAlign = "right";
        ctx.fillText(name, W - 22, 7);
        ctx.textAlign = "left";
        drawPint(W - 14, 18, 1, true);
      }
    }
    mug("left", p1.hp, "DUKE", "#c9a24a");
    mug("right", p2.hp, "LARK", "#6ec0ff");
    px(174, 4, 36, 14, "#1a1008");
    ctx.fillStyle = "#ffcc55";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(timer).padStart(2, "0"), 192, 15);
    ctx.textAlign = "left";
  }

  function drawTitle() {
    drawBar();
    ctx.fillStyle = "#0008";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff3355";
    ctx.font = "16px monospace";
    ctx.fillText("BAR FIGHTER 2", 192, 70);
    ctx.fillStyle = "#ffcc55";
    ctx.font = "7px monospace";
    ctx.fillText("WORLD WARRIOR OF THE STICKY FLOOR", 192, 86);
    if ((stateT >> 4) % 2 === 0) {
      ctx.fillStyle = "#f4e6c3";
      ctx.fillText("PRESS START  /  ENTER", 192, 130);
    }
    ctx.fillStyle = "#9a7a4a";
    ctx.font = "6px monospace";
    ctx.fillText("PAIR BLUETOOTH PADS  THEN PRESS A BUTTON", 192, 160);
    ctx.fillText("P1 WASD+JKL    P2 ARROWS+NUM    BLOCK = HOLD BACK", 192, 174);
    ctx.textAlign = "left";
    drawFighter({ ...p1, x: 90, y: FLOOR, attack: null, crouch: false, flash: 0, facing: 1 });
    drawFighter({ ...p2, x: 294, y: FLOOR, attack: null, crouch: false, flash: 0, facing: -1 });
  }

  function drawBump() {
    drawBar();
    const t = stateT;
    const walk = Math.min(t, 50);
    const d1 = makeFighter("DUKE", 40 + walk * 1.4, 1, p1.palette);
    const d2 = makeFighter("LARK", 344 - walk * 1.4, -1, p2.palette);
    d1.grounded = d2.grounded = true;
    drawFighter(d1);
    drawFighter(d2);
    if (t > 50) {
      drawPint(192 + Math.sin(t) * 8, FLOOR - 10 - (t - 50) * 0.6, 1.4, true);
      ctx.fillStyle = "#f4e6c3";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("HEY  WATCH IT", 192, 50);
      ctx.textAlign = "left";
    }
  }

  function drawCheers() {
    drawBar();
    drawFighter(p1);
    drawFighter(p2);
    const t = Math.min(stateT, 40);
    const k = t / 40;
    const gx = 40 + k * 120;
    drawPint(gx, 90, 3, true);
    drawPint(W - gx, 90, 3, true);
    if (t > 28) {
      ctx.fillStyle = "#ffcc55";
      ctx.font = "18px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ROUND 1", 192, 50);
      if (t > 36) ctx.fillText("FIGHT", 192, 150);
      ctx.textAlign = "left";
    }
  }

  function drawKO() {
    drawBar();
    drawFighter(p1);
    drawFighter(p2);
    for (const pint of pints) drawPint(pint.x, pint.y, 1, true);
    drawHUD();
    ctx.fillStyle = "#0006";
    ctx.fillRect(0, 70, W, 50);
    ctx.fillStyle = "#ff3355";
    ctx.font = "22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("K.O.", 192, 100);
    ctx.fillStyle = "#ffcc55";
    ctx.font = "8px monospace";
    ctx.fillText((winner ? winner.name : "NOBODY") + "  WINS", 192, 116);
    if (stateT > 80) ctx.fillText("START  TO  REMATCH", 192, 140);
    ctx.textAlign = "left";
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
      if (stateT === 52) audio.hit();
      drawBump();
      if (stateT > 90 || start) { state = "cheers"; stateT = 0; audio.clink(); }
    } else if (state === "cheers") {
      stateT++;
      if (stateT === 30) audio.clink();
      drawCheers();
      if (stateT > 70) { state = "fight"; stateT = 0; }
    } else if (state === "fight") {
      stateT++;
      timerAcc++;
      if (timerAcc >= 60) { timerAcc = 0; timer = Math.max(0, timer - 1); }
      if (timer === 0 && !winner) {
        winner = p1.hp >= p2.hp ? p1 : p2;
        if (p1.hp === p2.hp) winner = null;
        if (winner) winner.wins++;
        state = "ko"; stateT = 0; audio.ko();
      }
      faceEachOther();
      control(p1, i1);
      control(p2, i2);
      physics(p1);
      physics(p2);
      collideFighters();
      resolveHits();
      stepPints();

      if (shake > 0) shake--;
      ctx.save();
      if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBar();
      drawFighter(p1);
      drawFighter(p2);
      for (const pint of pints) drawPint(pint.x, pint.y, 1.2, true);
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
