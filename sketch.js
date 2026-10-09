// p5.js 1.11.13
// 1080 × 800，粉底绿水·流线化作“愁”字漂流。
// 问君能有几多愁，恰似一江春水向东流。
// 点击暂停 / 继续，按 S 保存。

const PINK = "#FDE8F4";
const PINK_PALE = "#FFF8FB"; // 右下端字色（绿水加深处字色变浅）
const CHAR_SHADES = 5;       // 字色由深到浅的档位数
const FLOW_SPEED = 48;

const BASE_W = 540;
const BASE_H = 400;
const STEPS = 360;
const FADE_EDGE = 3;

// 字流参数（替代原流线）
const CHAR_GAP = 10;        // 相邻字的沿线间距
const CHAR_SIZE = 10.5;     // 字头大小
const CHAR_SPEED = 0.85;    // 字速相对水波速度的比例
const END_FADE = 22;        // 河道两端淡入淡出的距离
const MIN_DRAW_ALPHA = 0.03;// 低于此透明度不绘制
const SHORE_MARGIN = 6;     // 字轨迹与岸线的最小间距（基准单位）

// 字潮呼吸（“问君能有几多愁”：愁绪缓缓涨落）
const BREATH_RATE = 0.35;   // 呼吸角速度，周期约 18 秒
const BREATH_DEPTH = 0.14;  // 呼吸幅度

// 末端消散（“恰似一江春水向东流”：愁到远处渐渐化开）
const DISSOLVE_AT = 0.9;    // 航程 90% 处开始消散
const DISSOLVE_LEN = 0.1;   // 消散段长度

// 花朵点睛（春意）：偶尔一朵五瓣小花顺流漂过，多了会闹
const PETAL_MAX = 20;            // 同屏最多朵数
const PETAL_INTERVAL_MIN = 2;  // 两次出现的最小间隔（秒）
const PETAL_INTERVAL_MAX = 5;  // 两次出现的最大间隔（秒）
const PETAL_SPEED = 1.5;        // 相对字流的速度倍数
const PETAL_SIZE = 2;           // 花朵尺度（基准单位，约为字头两倍）
const PETAL_COLOR = "#f3bed2";  // 花瓣玫瑰色（与嫩粉字头区分开）
const PISTIL_COLOR = "#FFE9A6"; // 花蕊淡黄色

// 拖尾定义：d = 落后距离，a = 相对亮度，s = 相对大小
const TRAILS = [
  { d: 0,  a: 0.40, s: 1.25 },
  { d: 6,  a: 0.45, s: 0.85 },
  { d: 12, a: 0.18, s: 0.72 },
  { d: 18, a: 0.07, s: 0.62 }
];

const LEFT = [
  [-46, -24],
  [-24, 11, -17, 36, 13, 53],
  [60, 78, 78, 77, 129, 81],
  [153, 84, 169, 93, 153, 97],
  [128, 104, 82, 107, 106, 132],
  [129, 151, 185, 170, 223, 174],
  [249, 179, 299, 175, 286, 190],
  [273, 203, 190, 203, 190, 234],
  [185, 257, 257, 273, 284, 291],
  [304, 309, 352, 301, 359, 317],
  [368, 326, 331, 324, 340, 342],
  [348, 364, 429, 398, 473, 398],
  [509, 401, 536, 394, 580, 399]
];

const RIGHT_EDGE = [
  [20, -16],
  [52, 2, 67, 32, 112, 31],
  [141, 33, 152, 23, 185, 33],
  [227, 48, 309, 46, 309, 81],
  [311, 110, 223, 105, 223, 129],
  [223, 151, 315, 138, 345, 138],
  [382, 136, 505, 153, 505, 184],
  [505, 208, 444, 204, 435, 222],
  [416, 251, 491, 251, 558, 244],
  [615, 238, 654, 270, 685, 295],
  [716, 320, 748, 343, 785, 365],
  [816, 387, 850, 414, 885, 434],
  [920, 460, 960, 480, 995, 495]
];

let edgeA = [];
let edgeB = [];
let streams = [];
let water;
let still;
let charShadeSharp = [];
let charShadeSoft = [];

let flowTime = 0;
let playing = true;
let petals = [];
let nextPetalAt = 0; // 开场即出现第一朵

function setup() {
  createCanvas(1080, 800);
  pixelDensity(1);
  frameRate(30);
  randomSeed(36);

  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS * (LEFT.length - 1);
    edgeA.push(sampleCurve(LEFT, s));
    edgeB.push(sampleCurve(RIGHT_EDGE, s));
  }

  water = new Path2D();

  for (let i = 0; i <= STEPS; i++) {
    const p = edgeA[i];

    if (i === 0) {
      water.moveTo(p.x, p.y);
    } else {
      water.lineTo(p.x, p.y);
    }
  }

  for (let i = STEPS; i >= 0; i--) {
    water.lineTo(edgeB[i].x, edgeB[i].y);
  }

  water.closePath();

  // 贴岸的两对流线整体向内收，避免字压到岸线
  for (const u of [0.05, 0.09, 0.91, 0.95]) {
    addStream(u, 0, -1);
  }

  const centers = [0.17, 0.39, 0.63, 0.83];

  for (let g = 0; g < centers.length; g++) {
    for (let offset = -1; offset <= 1; offset++) {
      addStream(centers[g], offset, g);
    }
  }

  // 开场先在河道中段放两朵，不用等它们从上游漂来
  for (let i = 0; i < 2; i++) {
    const stream = streams[Math.floor(random(streams.length))];

    petals.push({
      stream: stream,
      d: random(stream.total * 0.25, stream.total * 0.6),
      speed: FLOW_SPEED * stream.speed * CHAR_SPEED * PETAL_SPEED,
      size: PETAL_SIZE * random(0.9, 1.2),
      spin: random(0.4, 0.9) * (random() < 0.5 ? -1 : 1),
      phase: random(Math.PI * 2)
    });
  }

  // 字流贴图：右下深水段字色变浅，预渲染多档（锐利字头 + 模糊光晕）
  for (let i = 0; i < CHAR_SHADES; i++) {
    const t = i / (CHAR_SHADES - 1);
    const color = mixColor(PINK, PINK_PALE, t);

    charShadeSharp.push(makeCharSprite(color, 40, 0));
    charShadeSoft.push(makeCharSprite(color, 40, 5));
  }

  // 缓存静态底图（粉色晕染底）
  still = createGraphics(width, height);
  still.pixelDensity(1);
  still.background("#F6E7EA");
  paintWash(still, [
    // [x 比例, y 比例, 半径比例, 颜色, 强度]
    [0.15, 0.18, 0.55, "#F2BCCB", 0.85],
    [0.44, 0.08, 0.40, "#EFA9BE", 0.70],
    [0.06, 0.55, 0.50, "#F3C6D2", 0.80],
    [0.38, 0.45, 0.62, "#F6D3DB", 0.60],
    [0.70, 0.14, 0.38, "#F0B3C6", 0.65],
    [0.92, 0.40, 0.42, "#F4CBD6", 0.55],
    [0.55, 0.85, 0.48, "#F5D5DD", 0.50],
    [0.85, 0.88, 0.40, "#F1E0D3", 0.40],
    [0.82, 0.58, 0.36, "#DFE8C6", 0.45],
    [0.98, 0.75, 0.30, "#E6ECD0", 0.40],
    [0.02, 0.95, 0.35, "#F4CBD6", 0.45]
  ]);

  const ctx = still.drawingContext;

  ctx.save();
  ctx.scale(width / BASE_W, height / BASE_H);

  // 渐变绿色水体（右下角最后 15% 加深，深度不超过原版最深色）
  const green = ctx.createLinearGradient(0, 0, 450, 400);

  green.addColorStop(0.00, "#BBE9A3");
  green.addColorStop(0.28, "#A7E985");
  green.addColorStop(0.52, "#9BE176");
  green.addColorStop(0.76, "#B3F490");
  green.addColorStop(0.85, "#A8E380");
  green.addColorStop(1.00, "#9BE176");

  ctx.fillStyle = green;
  ctx.fill(water);

  // 粉色外轮廓
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 0.55;
  ctx.stroke(water);

  ctx.restore();
}

function draw() {
  const dt = playing ? Math.min(deltaTime, 60) / 1000 : 0;

  flowTime += dt;

  // 字潮呼吸：整体亮度以约 18 秒为周期缓缓涨落
  const breath =
    1 - BREATH_DEPTH * (0.5 - 0.5 * Math.sin(flowTime * BREATH_RATE));

  image(still, 0, 0);

  const ctx = drawingContext;

  ctx.save();

  ctx.scale(width / BASE_W, height / BASE_H);
  ctx.clip(water);

  // 字流：沿原流线轨迹漂流，带光晕与拖尾
  for (const stream of streams) {
    const shift =
      flowTime * FLOW_SPEED * stream.speed + stream.phase;

    const period = stream.length + stream.gap;
    const total = stream.total;

    for (const ch of stream.chars) {
      const d = (ch.off + shift * CHAR_SPEED) % total;

      const q =
        ((d - shift) % period + period) % period;

      const low =
        0.24 * softBand(q, 0, stream.length);

      const middle =
        0.42 * softBand(
          q,
          stream.length * 0.20,
          stream.length * 0.65
        );

      const high =
        0.85 * softBand(
          q,
          stream.length * 0.62,
          stream.length * 0.28
        );

      const alpha =
        (1 - (1 - low) * (1 - middle) * (1 - high)) * breath;

      if (alpha < MIN_DRAW_ALPHA) continue;

      const endFade = Math.min(
        1,
        d / END_FADE,
        (total - d) / END_FADE
      );

      const raw = d / total;
      const p = pointAt(stream.points, d);

      // 末端消散：最后 10% 航程渐渐虚化缩小
      const dis = raw > DISSOLVE_AT ?
        (raw - DISSOLVE_AT) / DISSOLVE_LEN : 0;
      const size =
        CHAR_SIZE * (0.9 + 0.18 * alpha) * (1 - 0.45 * dis);

      // 流到右下深水段字色变浅：前 55% 航程保持原色
      const tone = raw < 0.55 ? 0 : (raw - 0.55) / 0.45;

      const idx = Math.round(tone * (CHAR_SHADES - 1));

      // 拖尾与光晕（先画，垫在字头下面）
      for (const tr of TRAILS) {
        const gd = d - tr.d;

        if (gd < 0) continue;

        const gEnd = Math.min(
          1,
          gd / END_FADE,
          (total - gd) / END_FADE
        );

        const ga = alpha * tr.a * endFade * gEnd;

        if (ga < MIN_DRAW_ALPHA) continue;

        const gp = pointAt(stream.points, gd);
        const gs = CHAR_SIZE * tr.s;

        ctx.globalAlpha = ga;
        ctx.drawImage(
          charShadeSoft[idx].canvas,
          gp.x - gs / 2,
          gp.y - gs / 2,
          gs,
          gs
        );
      }

      // 字头（末端由锐利渐渐虚化）
      if (dis > 0) {
        ctx.globalAlpha = alpha * endFade * (1 - dis);
        ctx.drawImage(
          charShadeSharp[idx].canvas,
          p.x - size / 2,
          p.y - size / 2,
          size,
          size
        );

        ctx.globalAlpha = alpha * endFade * dis;
        ctx.drawImage(
          charShadeSoft[idx].canvas,
          p.x - size / 2,
          p.y - size / 2,
          size,
          size
        );
      } else {
        ctx.globalAlpha = alpha * endFade;
        ctx.drawImage(
          charShadeSharp[idx].canvas,
          p.x - size / 2,
          p.y - size / 2,
          size,
          size
        );
      }
    }
  }

  // 花朵点睛：开场已有两朵，之后偶尔补一朵
  if (flowTime >= nextPetalAt && petals.length < PETAL_MAX) {
    spawnPetal();
    nextPetalAt =
      flowTime +
      random(PETAL_INTERVAL_MIN, PETAL_INTERVAL_MAX);
  }

  for (let i = petals.length - 1; i >= 0; i--) {
    const petal = petals[i];

    petal.d += petal.speed * dt;

    if (petal.d >= petal.stream.total) {
      petals.splice(i, 1);
      continue;
    }

    const fade = Math.min(
      1,
      petal.d / 30,
      (petal.stream.total - petal.d) / 30
    );

    const p = pointAt(petal.stream.points, petal.d);
    const ahead = pointAt(
      petal.stream.points,
      Math.min(petal.stream.total, petal.d + 6)
    );
    const along = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    const sway =
      Math.sin(flowTime * 1.3 + petal.phase) * 1.2;

    ctx.save();
    ctx.translate(
      p.x + Math.cos(along + Math.PI / 2) * sway,
      p.y + Math.sin(along + Math.PI / 2) * sway
    );
    ctx.rotate(petal.spin * flowTime + petal.phase);
    ctx.globalAlpha = 0.95 * Math.max(0, fade);

    // 五片花瓣环绕排列
    ctx.fillStyle = PETAL_COLOR;

    for (let pi = 0; pi < 5; pi++) {
      const a = pi / 5 * Math.PI * 2;
      const px = Math.cos(a) * petal.size * 0.75;
      const py = Math.sin(a) * petal.size * 0.75;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        petal.size * 0.62,
        petal.size * 0.38,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }

    // 花蕊
    ctx.fillStyle = PISTIL_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, petal.size * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// 沿单条流线的弧长等距布字
function addStream(center, offset, group) {
  const points = [];

  let previous = null;
  let totalDistance = 0;

  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS * (LEFT.length - 1);

    const a = edgeA[i];
    const b = edgeB[i];

    let u = center;

    if (group >= 0) {
      const drift =
        Math.sin(
          s * 1.15 + group * 1.7
        ) * 0.047 +
        Math.sin(
          s * 2.2 + group
        ) * 0.021;

      const opening =
        0.5 +
        0.5 * Math.sin(
          s * 1.8 + group
        );

      u +=
        drift +
        offset *
        (0.012 + 0.045 * opening * opening);
    }

    // 轨迹向岸内收缩：按字高与岸线保持间距
    const shoreWidth = Math.hypot(b.x - a.x, b.y - a.y);
    const shoreLimit = Math.min(
      0.5,
      SHORE_MARGIN / Math.max(1, shoreWidth)
    );

    u = Math.min(Math.max(u, shoreLimit), 1 - shoreLimit);

    const x =
      a.x + (b.x - a.x) * u;

    const y =
      a.y + (b.y - a.y) * u;

    if (previous !== null) {
      totalDistance += Math.hypot(x - previous.x, y - previous.y);
    }

    points.push({
      x: x,
      y: y,
      d: totalDistance
    });

    previous = {
      x: x,
      y: y
    };
  }

  const chars = [];
  const count = Math.floor(totalDistance / CHAR_GAP);

  for (let i = 0; i < count; i++) {
    chars.push({
      off: (i + 0.5) * CHAR_GAP
    });
  }

  const id = streams.length;

  streams.push({
    points: points,
    chars: chars,
    total: totalDistance,
    length: 65 + (id % 4) * 13,
    gap: 105 + (id % 3) * 23,
    phase: id * 39,
    speed: 0.88 + (id % 5) * 0.055
  });
}

// 二分查找弧长 d 处的坐标
function pointAt(points, d) {
  let low = 0;
  let high = points.length - 1;

  while (high - low > 1) {
    const mid = (low + high) >> 1;

    if (points[mid].d < d) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const p0 = points[low];
  const p1 = points[high];
  const t =
    (d - p0.d) / Math.max(0.0001, p1.d - p0.d);

  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t
  };
}

// 随机挑一条流线放下一朵花
function spawnPetal() {
  const stream = streams[Math.floor(random(streams.length))];

  petals.push({
    stream: stream,
    d: random(0, stream.total * 0.1),
    speed: FLOW_SPEED * stream.speed * CHAR_SPEED * PETAL_SPEED,
    size: PETAL_SIZE * random(0.9, 1.2),
    spin: random(0.4, 0.9) * (random() < 0.5 ? -1 : 1),
    phase: random(Math.PI * 2)
  });
}

function softBand(position, start, length) {
  const d = Math.min(
    position - start,
    start + length - position
  );

  if (d <= 0) return 0;
  if (d >= FADE_EDGE) return 1;

  const t = d / FADE_EDGE;

  return t * t * (3 - 2 * t);
}

// 预渲染一枚指定颜色的“愁”字贴图，可带模糊
function makeCharSprite(color, px, blurPx) {
  const img = createGraphics(64, 64);

  img.pixelDensity(2);
  img.clear();

  if (blurPx > 0) {
    img.drawingContext.filter = "blur(" + blurPx + "px)";
  }

  img.noStroke();
  img.fill(color);
  img.textFont('"Songti SC", "SimSun", serif');
  img.textAlign(CENTER, CENTER);
  img.textSize(px);
  img.text("愁", 32, 32);

  return img;
}

// 在底图上绘制大块柔边晕染色斑，模拟参考图的水彩粉底
function paintWash(g, spots) {
  const ctx = g.drawingContext;

  ctx.save();
  ctx.filter = "blur(" + Math.round(g.width * 0.045) + "px)";

  for (const spot of spots) {
    const x = spot[0] * g.width;
    const y = spot[1] * g.height;
    const r = spot[2] * g.width;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);

    grad.addColorStop(0, hexWithAlpha(spot[3], spot[4]));
    grad.addColorStop(1, hexWithAlpha(spot[3], 0));

    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  ctx.restore();
}

function hexWithAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
}

// 两个 hex 颜色按 t 插值
function mixColor(a, b, t) {
  const r0 = parseInt(a.slice(1, 3), 16);
  const g0 = parseInt(a.slice(3, 5), 16);
  const b0 = parseInt(a.slice(5, 7), 16);
  const r1 = parseInt(b.slice(1, 3), 16);
  const g1 = parseInt(b.slice(3, 5), 16);
  const b1 = parseInt(b.slice(5, 7), 16);

  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const bl = Math.round(b0 + (b1 - b0) * t);

  function to2(v) {
    return v.toString(16).padStart(2, "0");
  }

  return "#" + to2(r) + to2(g) + to2(bl);
}

function sampleCurve(edge, s) {
  const index = Math.min(
    edge.length - 2,
    Math.floor(s)
  );

  const t = Math.min(
    1,
    s - index
  );

  const v = 1 - t;

  const previous = edge[index];
  const segment = edge[index + 1];

  const startX =
    previous[previous.length - 2];

  const startY =
    previous[previous.length - 1];

  return {
    x:
      v * v * v * startX +
      3 * v * v * t * segment[0] +
      3 * v * t * t * segment[2] +
      t * t * t * segment[4],

    y:
      v * v * v * startY +
      3 * v * v * t * segment[1] +
      3 * v * t * t * segment[3] +
      t * t * t * segment[5]
  };
}

function mousePressed() {
  if (
    mouseX < 0 ||
    mouseX > width ||
    mouseY < 0 ||
    mouseY > height
  ) {
    return;
  }

  playing = !playing;

  if (playing) {
    loop();
  } else {
    noLoop();
  }
}

function keyPressed() {
  if (key === "s" || key === "S") {
    saveCanvas(
      "chou-drift-river",
      "png"
    );
  }
}