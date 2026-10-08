// p5.js 1.11.13
// 1080 × 800，粉绿水纹与漂流的“愁”。
// 点击暂停 / 继续，按 S 保存。

const PINK = "#FDE8F4";
const FLOW_SPEED = 48;
const WORD_COUNT = 32;

const BASE_W = 540;
const BASE_H = 400;
const STEPS = 360;
const LEVELS = 48;
const FADE_EDGE = 3;

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

const RIGHT = [
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
let words = [];
let water;
let still;
let wordImage;

let flowTime = 0;
let playing = true;

function setup() {
  createCanvas(1080, 800);
  pixelDensity(1);
  frameRate(30);
  randomSeed(36);

  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS * (LEFT.length - 1);
    edgeA.push(sampleCurve(LEFT, s));
    edgeB.push(sampleCurve(RIGHT, s));
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

  for (const u of [0.017, 0.035, 0.965, 0.984]) {
    addStream(u, 0, -1);
  }

  const centers = [0.17, 0.39, 0.63, 0.83];

  for (let g = 0; g < centers.length; g++) {
    for (let offset = -1; offset <= 1; offset++) {
      addStream(centers[g], offset, g);
    }
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

  // 渐变绿色水体
  const green = ctx.createLinearGradient(0, 0, 450, 400);

  green.addColorStop(0.00, "#BBE9A3");
  green.addColorStop(0.28, "#A7E985");
  green.addColorStop(0.52, "#9BE176");
  green.addColorStop(0.76, "#B3F490");
  green.addColorStop(1.00, "#BBE9A3");

  ctx.fillStyle = green;
  ctx.fill(water);

  // 粉色外轮廓
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 0.55;
  ctx.stroke(water);

  ctx.clip(water);

  // 粉色基础线条
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 0.5;

  for (const stream of streams) {
    ctx.stroke(stream.path);
  }

  ctx.restore();

  // “愁”字只绘制一次，动画中重复使用
  wordImage = createGraphics(40, 40);
  wordImage.pixelDensity(2);
  wordImage.clear();
  wordImage.noStroke();
  wordImage.fill(PINK);
  wordImage.textFont('"Songti SC", "SimSun", serif');
  wordImage.textAlign(CENTER, CENTER);
  wordImage.textSize(32);
  wordImage.text("愁", 20, 19);

  for (let i = 0; i < WORD_COUNT; i++) {
    addWord(i);
  }
}

function draw() {
  const dt = playing ? Math.min(deltaTime, 60) / 1000 : 0;

  flowTime += dt;

  image(still, 0, 0);

  const batches = [];

  for (let i = 0; i < LEVELS; i++) {
    batches.push(new Path2D());
  }

  for (const stream of streams) {
    const shift =
      flowTime * FLOW_SPEED * stream.speed + stream.phase;

    const length = stream.length;
    const period = length + stream.gap;
    const segments = stream.segments;

    for (let i = 0; i < segments.length; i += 5) {
      const q =
        ((segments[i + 4] - shift) % period + period) % period;

      const low =
        0.24 * softBand(q, 0, length);

      const middle =
        0.42 * softBand(
          q,
          length * 0.20,
          length * 0.65
        );

      const high =
        0.85 * softBand(
          q,
          length * 0.62,
          length * 0.28
        );

      const alpha =
        1 - (1 - low) * (1 - middle) * (1 - high);

      const level = Math.round(
        alpha * (LEVELS - 1)
      );

      if (level === 0) continue;

      batches[level].moveTo(
        segments[i],
        segments[i + 1]
      );

      batches[level].lineTo(
        segments[i + 2],
        segments[i + 3]
      );
    }
  }

  const ctx = drawingContext;

  ctx.save();

  ctx.scale(width / BASE_W, height / BASE_H);
  ctx.clip(water);

  ctx.strokeStyle = PINK;
  ctx.lineWidth = 0.65;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = 1; i < LEVELS; i++) {
    ctx.globalAlpha = i / (LEVELS - 1);
    ctx.stroke(batches[i]);
  }

  // 小字沿独立轨迹漂流
  for (const word of words) {
    word.distance =
      (word.distance + word.speed * dt) % word.total;

    const p = pointOnRoute(
      word.route,
      word.distance
    );

    const fade = Math.min(
      1,
      word.distance / 18,
      (word.total - word.distance) / 18
    );

    ctx.globalAlpha =
      word.opacity * Math.max(0, fade);

    ctx.drawImage(
      wordImage.canvas,
      p.x - word.size / 2,
      p.y - word.size / 2,
      word.size,
      word.size
    );
  }

  ctx.restore();
}

function addWord(id) {
  const route = [];

  const lane = random(0.08, 0.92);
  const phase = random(Math.PI * 2);

  let total = 0;
  let previous = null;
  let lastVisible = 0;

  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS * (LEFT.length - 1);

    const u =
      lane +
      Math.sin(s * 0.85 + phase) * 0.025;

    const a = edgeA[i];
    const b = edgeB[i];

    const x = a.x + (b.x - a.x) * u;
    const y = a.y + (b.y - a.y) * u;

    if (previous) {
      total += Math.hypot(
        x - previous.x,
        y - previous.y
      );
    }

    route.push({
      x: x,
      y: y,
      distance: total
    });

    if (
      x >= -10 &&
      x <= BASE_W + 10 &&
      y >= -10 &&
      y <= BASE_H + 10
    ) {
      lastVisible = i;
    }

    previous = {
      x: x,
      y: y
    };
  }

  route.length = Math.min(
    route.length,
    lastVisible + 2
  );

  total = route[route.length - 1].distance;

  words.push({
    route: route,
    total: total,
    distance:
      total * (id + random(0.1, 0.9)) / WORD_COUNT,
    speed: random(19, 29),
    size: random(10, 14),
    opacity: random(0.65, 0.88)
  });
}

function pointOnRoute(route, distance) {
  let low = 0;
  let high = route.length - 1;

  while (high - low > 1) {
    const mid = (low + high) >> 1;

    if (route[mid].distance < distance) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const a = route[low];
  const b = route[high];

  const t =
    (distance - a.distance) /
    Math.max(
      0.0001,
      b.distance - a.distance
    );

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
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

function addStream(center, offset, group) {
  const path = new Path2D();
  const segments = [];

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

    const x =
      a.x + (b.x - a.x) * u;

    const y =
      a.y + (b.y - a.y) * u;

    if (previous === null) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);

      const dx = x - previous.x;
      const dy = y - previous.y;
      const distance = Math.hypot(dx, dy);

      const count = Math.max(
        1,
        Math.ceil(distance / 1.5)
      );

      for (let k = 0; k < count; k++) {
        const t0 = k / count;
        const t1 = (k + 1) / count;

        const x0 = previous.x + dx * t0;
        const y0 = previous.y + dy * t0;
        const x1 = previous.x + dx * t1;
        const y1 = previous.y + dy * t1;

        if (
          Math.max(x0, x1) < 0 ||
          Math.min(x0, x1) > BASE_W ||
          Math.max(y0, y1) < 0 ||
          Math.min(y0, y1) > BASE_H
        ) {
          continue;
        }

        segments.push(
          x0,
          y0,
          x1,
          y1,
          totalDistance +
          distance * (t0 + t1) * 0.5
        );
      }

      totalDistance += distance;
    }

    previous = {
      x: x,
      y: y
    };
  }

  const id = streams.length;

  streams.push({
    path: path,
    segments: new Float32Array(segments),
    length: 65 + (id % 4) * 13,
    gap: 105 + (id % 3) * 23,
    phase: id * 39,
    speed: 0.88 + (id % 5) * 0.055
  });
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
      "pink-green-flowing-river",
      "png"
    );
  }
}
