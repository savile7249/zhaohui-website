import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import * as A from "../../../.agents/skills/anatomy/kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

// Isometric frame for a clean vertical PTFE-lined storage tank:
// - Full 360° 36-bolt top main flange & full 360° flared PTFE sealing lip
// - Diagonal longitudinal split-shell cutaway on the straight barrel revealing bright continuous PTFE lining
// - Prominent side-opening lower discharge nozzle on the front-right lower head flank
// - Stationary rigid 4-leg + square anchor base plate frame seated flush into contoured lower-head leg sleeves
const W = 640;
const H = 820;
const AZIMUTH = 42;
const ELEVATION = 25;

// Split plane perpendicular to horizontal view direction (AZIMUTH = 42°)
const CUT_LEFT_DEG = AZIMUTH + 90; // 132°
const CUT_RIGHT_DEG = AZIMUTH - 90; // -48°
const PULL_DEG = 104; // Front-left diagonal pull: screenX = -0.88, depth = +0.47 > 0
const PULL_DIR = [Math.cos(PULL_DEG * DEG), Math.sin(PULL_DEG * DEG), 0];

const PULL_LINING = 46;
const PULL_SHELL = 100;

// Tank dimensions
const R_SHELL = 54;
const R_SHELL_IN = 50.2;
const R_LINER_OUT = 50.0;
const R_LINER_IN = 46.8;
const R_FLANGE = 61.5;
const R_LIP = 58.2;

// Assembled Z elevations
const Z_PAD_TOP = 2.4;
const Z_LOWER_BOT = 45.8;
const Z_LOWER_TOP = 75.0;
const Z_SHELL_TOP = 210.0;
const Z_LIP_TOP = 213.0;
const Z_HEAD_FLANGE_TOP = 218.0;
const HEAD_H = 29.2;
const Z_HEAD_TOP = Z_HEAD_FLANGE_TOP + HEAD_H; // 247.2
const R_NOZZLE_NECK = 2.8;
const R_NOZZLE_FLANGE = 5.6;

// 4 tubular support legs welded rigidly to 4 square anchor base plates at 45° / 135° / 225° / 315°
const LEG_R = 38;
const LEG_TUBE_R = 4.8;
const LEG_PAD_R = LEG_TUBE_R; // Same diameter as tubular leg so leg-to-head joint is completely seamless!
const LEG_DEGS = [45, 135, 225, 315];

// Strictly below lowerHeadZ(LEG_R - LEG_TUBE_R) = 51.97 so all 4 saddles have positive height (1.97..7.2) everywhere
const lowerHeadZ = (r) => Z_LOWER_TOP - HEAD_H * Math.sqrt(Math.max(0, 1 - (r / R_SHELL) ** 2));
const LEG_SEAT_Z = 50.0;

const cadDeg = (deg) => deg - 22;
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];

// Audited vertical explode offsets:
// legs + anchor pads are ONE stationary grounded assembly (move = [0, 0, 0]);
// modest 16-unit vertical clearance for lowerHead so tank lands cleanly on legs early in Step 05!
const MOVES = {
  legs: [0, 0, 0],
  lowerHead: [0, 0, 16],
  shellBack: [0, 0, 48],
  liningBack: [0, 0, 48],
  liningFront: [PULL_DIR[0] * PULL_LINING, PULL_DIR[1] * PULL_LINING, 48],
  shellFront: [PULL_DIR[0] * PULL_SHELL, PULL_DIR[1] * PULL_SHELL, 48],
  topHead: [0, 0, 120],
};

const STAGGER = ["topHead", "liningBack", "shellBack", "lowerHead", "legs"];
const SPRING = { stagger: 0.04, stiffness: 64, damping: 14.2, substeps: 4 };

const pullFar = [PULL_DIR[0] * PULL_SHELL, PULL_DIR[1] * PULL_SHELL];
const P = k.fitProjection(
  [
    [-70, -70, -4],
    [76, -70, -4],
    [-70, 70, -4],
    [76, 70, -4],
    [pullFar[0] - 64, pullFar[1] - 64, 66],
    [pullFar[0] + 64, pullFar[1] + 64, 210 + 66],
    [pullFar[0] - 64, pullFar[1] + 64, 210 + 66],
    [pullFar[0] + 64, pullFar[1] - 64, 66],
    [-66, -66, Z_HEAD_TOP + 14 + MOVES.topHead[2]],
    [66, 66, Z_HEAD_TOP + 14 + MOVES.topHead[2]],
    [-66, 66, Z_HEAD_TOP + 14 + MOVES.topHead[2]],
    [66, -66, Z_HEAD_TOP + 14 + MOVES.topHead[2]],
  ],
  W - 32,
  H,
  { pad: 14, azimuth: AZIMUTH, elevation: ELEVATION },
);

const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

const COL = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ex = (s) => [0, 0, s];

// Structural audit recorder (4 square base plates grounded to z = 0)
const R = A.recorder(P, {
  order: STAGGER,
  spring: SPRING,
  ground: (shape) => shape.name.startsWith("legs.plate"),
});
const { items, nameFor } = R;
const record = R.solid;

// Split-shell straight-barrel cutaway items (cross-faded cleanly into shell.whole at 92%..98%)
const splitItems = [];

function put(
  piece,
  ride,
  ref,
  svg,
  { bias = 0, shapes = [], name, extraClass = "", role = "common", split = false, fixedKey = null } = {},
) {
  const move = MOVES[ride] ?? [0, 0, 0];
  if (split) {
    splitItems.push({
      piece,
      ride,
      role,
      key: fixedKey !== null ? fixedKey : G.dot3(ref, V) + bias,
      move,
      svg,
      name: name ?? nameFor(`${piece}.split`),
      extraClass,
    });
    return;
  }
  R.put({
    piece,
    ride,
    role,
    at: ref,
    bias,
    svg,
    move,
    shapes,
    name: name ?? nameFor(`${piece}.item`),
    extraClass,
  });
}

function discPart(
  piece,
  ride,
  F,
  s0,
  s1,
  r,
  style = {},
  { extra = "", inner = "", bias = 0, bevel = 0, steps, name, owner, extraClass = "", role = "common" } = {},
) {
  const facetSteps = steps ?? (r > 40 ? 52 : r > 15 ? 36 : 22);
  const paths = G.disc(s0, s1, r, F, P, { bevel, steps: facetSteps });
  const id = nameFor(name ?? `${piece}.disc`);
  const shape = record(A.disc(F, s0, s1, r, { name: id, owner }));
  const mid = (s0 + s1) / 2;
  put(
    piece,
    ride,
    G.add3(F.o, G.mul3(F.a, mid)),
    S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra,
    { bias, name: id, shapes: [shape], extraClass, role },
  );
  return shape;
}

function flangeRing(
  piece,
  ride,
  z0,
  z1,
  rOut,
  { bolts = 36, boltR, topBolts = true, bevel = 0.55, tone = "hi", openBore = 0, name, bias = 0, extraClass = "", role = "common" } = {},
) {
  const id = nameFor(name ?? `${piece}.flange`);
  const extraParts = [];
  if (openBore > 0) {
    const voidPath = G.circleOf(COL, z1, openBore, P, 52);
    extraParts.push(`<path class="pt-tower-void" d="${voidPath}"/>`);
    extraParts.push(Ln(voidPath, { tone: "mid" }));
    extraParts.push(Ln(G.arcOf(COL, z1, openBore, P, { inward: true, least: -1, steps: 52 }), { tone: "faint" }));
  }
  if (topBolts && bolts > 0) {
    extraParts.push(Dots(G.dotsOf(COL, z1, boltR ?? rOut - 3.0, bolts, P, { all: true }), { size: 0.4, tone: "mid" }));
  }
  return discPart(piece, ride, COL, z0, z1, rOut, { tone }, { bevel, extra: extraParts.join(""), bias, name: id, extraClass, role });
}

function saddlePad(piece, ride, host, point, outward, a, h, { tone = "hi", bias = 0.2, name, owner } = {}) {
  const hosts = [host].flat();
  const inside = (p) => hosts.some((shape) => A.sdf(shape, p) < 0);
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const start = (angle) => {
    let lo = -2.4 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 36; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 40 }, (_, index) => start((index / 40) * Math.PI * 2)));
  const id = nameFor(name ?? `${piece}.pad`);
  put(
    piece,
    ride,
    G.add3(point, G.mul3(axis, h / 2)),
    S(G.saddleOf(F, a, start, h, P, { steps: 28 }), { tone }),
    { bias, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] },
  );
  return { face: G.add3(point, G.mul3(axis, h)), axis, F };
}

function cRing(rOut, rIn, aStartDeg, aEndDeg, steps = 30) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (aStartDeg + ((aEndDeg - aStartDeg) * i) / steps) * DEG;
    pts.push([Math.cos(a) * rOut, Math.sin(a) * rOut]);
  }
  for (let i = steps; i >= 0; i--) {
    const a = (aStartDeg + ((aEndDeg - aStartDeg) * i) / steps) * DEG;
    pts.push([Math.cos(a) * rIn, Math.sin(a) * rIn]);
  }
  return pts;
}

function arcLine(r, aStartDeg, aEndDeg, z, steps = 28) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = (aStartDeg + ((aEndDeg - aStartDeg) * i) / steps) * DEG;
    pts.push(at([Math.cos(a) * r, Math.sin(a) * r, z]));
  }
  return k.pathOf(pts);
}

function splitRingPart(
  piece,
  ride,
  half,
  z0,
  z1,
  rOut,
  rIn,
  { tone = "hi", crease = "faint", extraClass = "", name, depthOffset = 0, seamZs = [], cutOutlineTone = "mid", steps = 30 } = {},
) {
  const a0 = half === "back" ? CUT_LEFT_DEG : CUT_RIGHT_DEG;
  const a1 = half === "back" ? CUT_LEFT_DEG + 180 : CUT_LEFT_DEG;
  const ringPts = cRing(rOut, rIn, a0, a1, steps);
  const paths = k.extrude(ringPts, z0, z1 - z0, P, { convex: false });
  paths.seamless = true;

  const innerLines = [];
  if (half === "back") {
    for (const deg of [CUT_LEFT_DEG, CUT_RIGHT_DEG]) {
      const rad = dir(deg);
      innerLines.push(k.rise([rad[0] * rIn, rad[1] * rIn], z0, z1, P));
    }
    for (const zs of seamZs) {
      innerLines.push(arcLine(rIn, a0, a1, zs, 26));
    }
  } else {
    for (const zs of seamZs) {
      innerLines.push(arcLine(rOut, a0, a1, zs, 26));
    }
  }

  const extras = [];
  if (half === "back" && cutOutlineTone) {
    const cutPaths = [];
    for (const deg of [CUT_LEFT_DEG, CUT_RIGHT_DEG]) {
      const rad = dir(deg);
      const pOutB = at([rad[0] * rOut, rad[1] * rOut, z0]);
      const pOutT = at([rad[0] * rOut, rad[1] * rOut, z1]);
      const pInT = at([rad[0] * rIn, rad[1] * rIn, z1]);
      const pInB = at([rad[0] * rIn, rad[1] * rIn, z0]);
      cutPaths.push(k.pathOf([pOutB, pOutT, pInT, pInB], true));
    }
    extras.push(`<path class="pt-cut-face" d="${cutPaths.join("")}"/>`);
    extras.push(Ln(cutPaths.join(""), { tone: cutOutlineTone }));
  }

  const zMid = (z0 + z1) * 0.5;
  put(
    piece,
    ride,
    [0, 0, zMid],
    S(paths, { tone, crease, inner: innerLines.length ? Ln(innerLines.join(""), { tone: "faint" }) : "" }) + extras.join(""),
    {
      name: name ?? `${piece}.${half}`,
      extraClass: `${extraClass ? `${extraClass} ` : ""}pt-tower-split-shell`,
      role: "split",
      split: true,
      fixedKey: zMid * V[2] + depthOffset,
    },
  );
}

// =========================================================================
// 05. STATIONARY RIGID 4-LEG & SQUARE ANCHOR BASE PLATE ASSEMBLY (ride = "legs", move = [0, 0, 0])
// Anchor base plates + stiffener collars + tubular legs stay permanently welded & grounded!
// =========================================================================

for (const deg of LEG_DEGS) {
  const rad = dir(deg);
  const cx = rad[0] * LEG_R;
  const cy = rad[1] * LEG_R;
  const padHalf = 8.8;
  const plan = { x: cx - padHalf, y: cy - padHalf, w: padHalf * 2, d: padHalf * 2, r: 0.8 };
  const padId = `legs.plate.${deg}`;
  const boltPts = k.corners(plan, 2.4).map(([bx, by]) => at([bx, by, Z_PAD_TOP]));
  put(
    "legs",
    "legs",
    [cx, cy, Z_PAD_TOP / 2],
    S(k.slabOf(plan, 0, Z_PAD_TOP, P, 2, 0.35), { tone: "mid" }) +
      Ln(k.planOutline(k.insetPlan(plan, 1.4), Z_PAD_TOP, P, 2), { tone: "faint" }) +
      Dots(boltPts, { size: 0.45, tone: "hi" }),
    { name: padId, shapes: [record(A.box([plan.x, plan.y, 0], [plan.x + plan.w, plan.y + plan.d, Z_PAD_TOP], { name: padId }))] },
  );

  const LF = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  discPart("legs", "legs", LF, Z_PAD_TOP, Z_PAD_TOP + 3.2, LEG_TUBE_R + 1.6, { tone: "hi" }, {
    bevel: 0.2,
    name: `legs.foot.${deg}`,
  });
  // Tubular leg column meets lower.leg-pad.{deg} flush at LEG_SEAT_Z = 50.0 (cross-fades into seamless legs.whole at 92%..98%)
  discPart("legs", "legs", LF, Z_PAD_TOP + 3.2, LEG_SEAT_Z, LEG_TUBE_R, { tone: "hi" }, {
    bevel: 0.2,
    name: `legs.col.${deg}`,
    role: "split",
    extraClass: "pt-tower-split-shell",
    inner: G.arcOf(LF, Z_PAD_TOP + 18, LEG_TUBE_R, P),
  });
}

// =========================================================================
// 04. LOWER 2:1 ELLIPSOIDAL HEAD, PROMINENT SIDE DISCHARGE NOZZLE & CONTOURED LEG SLEEVES (lowerHead)
// =========================================================================

// Complete smooth analytic 2:1 ellipsoidal lower head (closed bottom crown at Z_LOWER_BOT = 45.8)
const lowerHeadRadius = (s) => {
  const u = Math.max(0, Math.min(1, (Z_LOWER_TOP - s) / HEAD_H));
  return R_SHELL * Math.sqrt(Math.max(0, 1 - u * u));
};
const lowerHeadSlope = (s) => {
  const u = Math.max(0, Math.min(0.996, (Z_LOWER_TOP - s) / HEAD_H));
  return (R_SHELL * u) / (HEAD_H * Math.sqrt(Math.max(1e-5, 1 - u * u)));
};
const lowerHeadProfile = Array.from({ length: 23 }, (_, idx) => {
  const t = idx / 22;
  const u = Math.cos(t * (Math.PI / 2));
  const s = Z_LOWER_TOP - HEAD_H * u;
  return idx === 0 ? [Z_LOWER_BOT, 0] : [s, lowerHeadRadius(s), idx < 22 ? 1 : 0];
});
const lowerHeadShape = record(A.solid(COL, lowerHeadProfile, { name: "lower.head", radius: lowerHeadRadius }));
const lowerOuterLiner = G.circleOf(COL, Z_LOWER_TOP, R_LINER_OUT, P, 48);
const lowerInnerVoid = G.circleOf(COL, Z_LOWER_TOP, R_LINER_IN, P, 48);
put(
  "lower",
  "lowerHead",
  ex((Z_LOWER_BOT + Z_LOWER_TOP) / 2),
  S(G.solidOf(lowerHeadProfile, COL, P, { steps: 52, smooth: { slope: lowerHeadSlope, rows: 4 } }), {
    tone: "hi",
    inner: Ln(
      [0.38, 0.72].map((u) => G.arcOf(COL, Z_LOWER_TOP - HEAD_H * u, lowerHeadRadius(Z_LOWER_TOP - HEAD_H * u), P, { slope: lowerHeadSlope(Z_LOWER_TOP - HEAD_H * u) })).join(""),
      { tone: "faint" },
    ),
  }) +
    `<path class="pt-lower-liner-ring" d="${lowerOuterLiner}"/>` +
    `<path class="pt-tower-void" d="${lowerInnerVoid}"/>` +
    Ln(lowerOuterLiner, { tone: "mid" }) +
    Ln(lowerInnerVoid, { tone: "faint" }),
  { name: "lower.head", shapes: [lowerHeadShape] },
);

// 4 Contoured leg tops welded flush into lower.head (exact same diameter as legs.col; cross-faded into unbroken legs.whole at 92%..98%)
const wholeLegs = [];
for (const deg of LEG_DEGS) {
  const rad = dir(deg);
  const cx = rad[0] * LEG_R;
  const cy = rad[1] * LEG_R;
  const DF = G.frameOf([cx, cy, 0], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const startFn = (angle) => {
    const px = cx + Math.cos(angle) * LEG_PAD_R;
    const py = cy - Math.sin(angle) * LEG_PAD_R;
    const rr = Math.min(R_SHELL - 0.5, Math.hypot(px, py));
    return -lowerHeadZ(rr);
  };
  const lowS = Math.min(...Array.from({ length: 32 }, (_, i) => startFn((i / 32) * Math.PI * 2)));
  const endS = -LEG_SEAT_Z;
  const id = `lower.leg-pad.${deg}`;
  put(
    "lower",
    "lowerHead",
    [cx, cy, (LEG_SEAT_Z + lowerHeadZ(LEG_R)) / 2],
    S(G.saddleOf(DF, LEG_PAD_R, startFn, endS, P, { steps: 28 }), { tone: "hi" }),
    {
      name: id,
      role: "split",
      extraClass: "pt-tower-split-shell",
      shapes: [record(A.disc(DF, lowS - 0.05, endS, LEG_PAD_R, { name: id, seated: true, cut: [lowerHeadShape] }))],
    },
  );

  // Unbroken single-piece tubular leg welded directly from base foot collar into curved lower.head (for 100% seamless state!)
  wholeLegs.push({
    deg,
    padId: id,
    svg: S(G.saddleOf(DF, LEG_TUBE_R, startFn, -(Z_PAD_TOP + 3.2), P, { steps: 28 }), { tone: "hi" }),
  });
}

// Prominent Side-Opening Flanged Discharge Nozzle on front-right lower flank (deg = -10°, z = 64.5)
// Clear between front legs (45° & 315°), bold bolted flange + open bore + bright flared PTFE sealing face!
{
  const OUTLET_DEG = -10;
  const OUTLET_Z = 64.5;
  const OUTLET_R = lowerHeadRadius(OUTLET_Z); // ~50.3
  const outward = dir(OUTLET_DEG);
  const neckR = 4.6;
  const flangeR = 8.4;
  const neckLen = 15.5;
  const pt = [outward[0] * OUTLET_R, outward[1] * OUTLET_R, OUTLET_Z];
  const pad = saddlePad("lower", "lowerHead", lowerHeadShape, pt, outward, neckR, neckLen, {
    tone: "hi",
    name: "lower.outlet-neck",
  });
  const OF = G.frameAlong(pad.face, pad.axis);
  const flangeT = 2.6;
  const bore = G.circleOf(OF, flangeT, 3.4, P, 24);
  discPart("lower", "lowerHead", OF, 0, flangeT, flangeR, { tone: "hi" }, {
    bevel: 0.25,
    bias: 0.3,
    name: "lower.outlet-flange",
    owner: "lower.outlet-neck",
    extra:
      `<path class="pt-tower-void" d="${bore}"/>` +
      Ln(bore, { tone: "mid" }) +
      Dots(G.dotsOf(OF, flangeT, flangeR * 0.78, 8, P, { all: true }), { size: 0.42, tone: "mid" }),
  });
  // Bright flared PTFE sealing face on the side discharge flange
  const lipBore = G.circleOf(OF, flangeT + 1.2, 3.4, P, 24);
  discPart("lining", "lowerHead", OF, flangeT, flangeT + 1.2, flangeR * 0.82, { tone: "hi" }, {
    bevel: 0.15,
    bias: 0.4,
    name: "lower.outlet-lip",
    owner: "lower.outlet-neck",
    extraClass: "pt-tower-lining-lip",
    extra: `<path class="pt-tower-void" d="${lipBore}"/>` + Ln(lipBore, { tone: "mid" }),
  });
}

// =========================================================================
// 03 & 02. CYLINDRICAL STEEL SHELL, CONTINUOUS PTFE LINER & FULL 360° TOP MAIN FLANGE
// - Top main body flange (shell.flange-top) & flared PTFE lip (lining.lip-main) stay FULL 360° RINGS at all times!
// - Only the straight cylindrical wall (z = 75..205) below the main flange splits diagonally into back/front halves,
//   and cross-fades cleanly into seamless shell.whole at 92%..98%.
// =========================================================================

// Audited seamless 360° whole cylinder barrel (fades in at 92%..98%)
discPart("shell", "shellBack", COL, Z_LOWER_TOP, 205, R_SHELL, { tone: "hi" }, {
  name: "shell.whole",
  inner: [118, 162].map((zs) => G.arcOf(COL, zs, R_SHELL, P)).join(""),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
});

// FULL 360° 36-bolt top main body flange (always complete 360° ring, role: "common"!)
flangeRing("shell", "shellBack", 205, Z_SHELL_TOP, R_FLANGE, {
  bolts: 36,
  boltR: R_FLANGE - 3.2,
  openBore: R_LINER_IN,
  bevel: 0.55,
  name: "shell.flange-top",
  role: "common",
});

// FULL 360° flared PTFE main-flange sealing lip (always complete 360° bright ring, role: "common"!)
flangeRing("lining", "liningBack", Z_SHELL_TOP, Z_LIP_TOP, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  openBore: R_LINER_IN,
  tone: "hi",
  name: "lining.lip-main",
  extraClass: "pt-tower-lining-lip",
  role: "common",
});

// Diagonal Split-Shell Cutaway Halves on the straight barrel (z = 75..205):
// 1) Back steel wall (depthOffset: -6.0)
splitRingPart("shell", "shellBack", "back", Z_LOWER_TOP, 205, R_SHELL, R_SHELL_IN, {
  name: "shell.back",
  depthOffset: -6.0,
  seamZs: [118, 162],
});

// 2) Back continuous PTFE inner liner wall (depthOffset: -2.8)
splitRingPart("lining", "liningBack", "back", Z_LOWER_TOP, 205, R_LINER_OUT, R_LINER_IN, {
  name: "lining.back",
  depthOffset: -2.8,
  seamZs: [118, 162],
  extraClass: "pt-tower-lining-sleeve",
  cutOutlineTone: "hi",
});

// 3) Front continuous PTFE inner liner wall (pulls diagonally to PULL_LINING)
splitRingPart("lining", "liningFront", "front", Z_LOWER_TOP, 205, R_LINER_OUT, R_LINER_IN, {
  name: "lining.front",
  depthOffset: 2.2,
  seamZs: [118, 162],
  extraClass: "pt-tower-lining-sleeve",
});

// 4) Front steel wall (pulls diagonally to PULL_SHELL, tucks cleanly under full 360° shell.flange-top when closed)
splitRingPart("shell", "shellFront", "front", Z_LOWER_TOP, 205, R_SHELL, R_SHELL_IN, {
  name: "shell.front",
  depthOffset: 5.0,
  seamZs: [118, 162],
});

// =========================================================================
// 01. FULL 360° REMOVABLE BOLTED TOP 2:1 ELLIPSOIDAL HEAD, 5 NOZZLES & 2 LUGS (topHead)
// =========================================================================

flangeRing("top", "topHead", Z_LIP_TOP, Z_HEAD_FLANGE_TOP, R_FLANGE, {
  bolts: 36,
  boltR: R_FLANGE - 3.2,
  topBolts: true,
  bevel: 0.55,
  bias: 5.8,
  name: "top.flange-bottom",
});

const topHeadRadius = (s) => {
  const u = Math.max(0, Math.min(1, (s - Z_HEAD_FLANGE_TOP) / HEAD_H));
  return R_SHELL * Math.sqrt(Math.max(0, 1 - u * u));
};
const topHeadSlope = (s) => {
  const u = Math.max(0, Math.min(0.996, (s - Z_HEAD_FLANGE_TOP) / HEAD_H));
  return (-R_SHELL * u) / (HEAD_H * Math.sqrt(Math.max(1e-5, 1 - u * u)));
};
const topHeadProfile = Array.from({ length: 23 }, (_, idx) => {
  const t = idx / 22;
  const u = Math.sin(t * (Math.PI / 2));
  const s = Z_HEAD_FLANGE_TOP + HEAD_H * u;
  return idx === 22 ? [Z_HEAD_TOP, 0] : [s, topHeadRadius(s), idx > 0 ? 1 : 0];
});
const topHeadShape = record(A.solid(COL, topHeadProfile, { name: "top.head", radius: topHeadRadius }));
put(
  "top",
  "topHead",
  ex((Z_HEAD_FLANGE_TOP + Z_HEAD_TOP) / 2),
  S(G.solidOf(topHeadProfile, COL, P, { steps: 52, smooth: { slope: topHeadSlope, rows: 4 } }), {
    tone: "hi",
    inner: Ln(
      [0.34, 0.66].map((u) => G.arcOf(COL, Z_HEAD_FLANGE_TOP + HEAD_H * u, topHeadRadius(Z_HEAD_FLANGE_TOP + HEAD_H * u), P, { slope: topHeadSlope(Z_HEAD_FLANGE_TOP + HEAD_H * u) })).join(""),
      { tone: "faint" },
    ),
  }),
  { name: "top.head", bias: 6.0, shapes: [topHeadShape] },
);

const TOP_NOZZLES = [
  { id: "n1", deg: 0 },
  { id: "n2", deg: 90 },
  { id: "n3", deg: 150 },
  { id: "n4", deg: 220 },
  { id: "n5", deg: 270 },
];
const NOZZLE_PITCH_R = 27;
const NOZZLE_TOP_Z = Z_HEAD_TOP + 9.0;

for (const nz of TOP_NOZZLES) {
  const wDeg = cadDeg(nz.deg);
  const rad = dir(wDeg);
  const nx = rad[0] * NOZZLE_PITCH_R;
  const ny = rad[1] * NOZZLE_PITCH_R;
  const domeZ = Z_HEAD_FLANGE_TOP + HEAD_H * Math.sqrt(1 - (NOZZLE_PITCH_R / R_SHELL) ** 2);
  const NF = G.frameOf([nx, ny, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

  const startFn = (angle) => {
    const px = nx + Math.cos(angle) * R_NOZZLE_NECK;
    const py = ny + Math.sin(angle) * R_NOZZLE_NECK;
    const rr = Math.min(R_SHELL - 0.5, Math.hypot(px, py));
    return Z_HEAD_FLANGE_TOP + HEAD_H * Math.sqrt(Math.max(0, 1 - (rr / R_SHELL) ** 2));
  };
  const lowZ = Math.min(...Array.from({ length: 32 }, (_, i) => startFn((i / 32) * Math.PI * 2)));
  const neckTop = NOZZLE_TOP_Z - 2.2;
  put(
    "top",
    "topHead",
    [nx, ny, (domeZ + neckTop) / 2],
    S(G.saddleOf(NF, R_NOZZLE_NECK, startFn, neckTop, P, { steps: 24 }), { tone: "hi" }),
    {
      bias: 6.2,
      name: `top.${nz.id}-neck`,
      shapes: [record(A.disc(NF, lowZ - 0.05, neckTop, R_NOZZLE_NECK, { name: `top.${nz.id}-neck`, seated: true, cut: [topHeadShape] }))],
    },
  );

  const bore = G.circleOf(NF, NOZZLE_TOP_Z, R_NOZZLE_NECK - 0.7, P, 20);
  discPart("top", "topHead", NF, neckTop, NOZZLE_TOP_Z, R_NOZZLE_FLANGE, { tone: "hi" }, {
    bevel: 0.2,
    bias: 6.2,
    name: `top.${nz.id}-flange`,
    owner: `top.${nz.id}-neck`,
    extra:
      `<path class="pt-tower-void" d="${bore}"/>` +
      Ln(bore, { tone: "mid" }) +
      Dots(G.dotsOf(NF, NOZZLE_TOP_Z, R_NOZZLE_FLANGE * 0.76, 4, P, { all: true }), { size: 0.35, tone: "mid" }),
  });
  discPart("lining", "topHead", NF, NOZZLE_TOP_Z, NOZZLE_TOP_Z + 0.9, R_NOZZLE_FLANGE * 0.78, { tone: "hi" }, {
    bevel: 0.12,
    bias: 6.3,
    name: `top.${nz.id}-lip`,
    owner: `top.${nz.id}-neck`,
    extraClass: "pt-tower-lining-lip",
    extra: `<path class="pt-tower-void" d="${G.circleOf(NF, NOZZLE_TOP_Z + 0.9, R_NOZZLE_NECK - 0.7, P, 20)}"/>`,
  });
}

for (const lugCad of [120, 300]) {
  const deg = cadDeg(lugCad);
  const rad = dir(deg);
  const tan = [-rad[1], rad[0], 0];
  const lugR = 57.5;
  const LF = G.frameOf([rad[0] * lugR, rad[1] * lugR, Z_HEAD_FLANGE_TOP], tan, rad, [0, 0, 1]);
  const lugPoly = [
    [-3.4, 0],
    [3.4, 0],
    [2.6, 8.5],
    [0, 11],
    [-2.6, 8.5],
  ];
  const id = `top.lug.${lugCad}`;
  put(
    "top",
    "topHead",
    [rad[0] * lugR, rad[1] * lugR, Z_HEAD_FLANGE_TOP + 5.5],
    S(G.prismOf(LF, lugPoly, -1.1, 1.1, P), { tone: "mid" }) +
      Dots([at([rad[0] * lugR, rad[1] * lugR, Z_HEAD_FLANGE_TOP + 7.2])], { size: 0.55, tone: "hi" }),
    { name: id, bias: 6.2, shapes: [record(A.prism(LF, lugPoly, -1.1, 1.1, { name: id, owner: "top.flange-bottom" }))] },
  );
}

// =========================================================================
// SETTLE DEPTH KEYS & RUN GEOMETRY AUDIT
// =========================================================================

A.settle(R, P);

// Slot unbroken single-piece seamless legs right at their audited leg-pad depth keys (for 100% seamless state)
for (const wl of wholeLegs) {
  const padItem = items.find((it) => it.name === wl.padId);
  splitItems.push({
    piece: "legs",
    ride: "legs",
    role: "whole",
    key: padItem ? padItem.key : 0,
    move: [0, 0, 0],
    svg: wl.svg,
    name: `legs.whole.${wl.deg}`,
    extraClass: "pt-tower-whole-shell",
  });
}

const allItems = [...items, ...splitItems].sort((a, b) => a.key - b.key);

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [Number((p[0] - o[0]).toFixed(4)), Number((p[1] - o[1]).toFixed(4))];
};

const assembledCenter = at([0, 0, (NOZZLE_TOP_Z + 4) / 2]);
const recenterAssembledX = Number((W * 0.5 - assembledCenter[0]).toFixed(1));
const recenterAssembledY = Number((H * 0.5 - assembledCenter[1]).toFixed(1));

const rightEdge = (r, z) => {
  const rad = dir(CUT_RIGHT_DEG);
  const pt = at([rad[0] * r, rad[1] * r, z]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
};

const outletAnchor = (() => {
  const rad = dir(-10);
  const pt = at([rad[0] * (lowerHeadRadius(64.5) + 19.5), rad[1] * (lowerHeadRadius(64.5) + 19.5), 64.5]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
})();

const anchors = {
  top: { at: rightEdge(R_FLANGE, Z_HEAD_FLANGE_TOP + 6), ride: "topHead" },
  lining: { at: rightEdge(R_LINER_OUT, 152), ride: "liningBack" },
  shell: { at: rightEdge(R_FLANGE, 207.5), ride: "shellBack" },
  lower: { at: outletAnchor, ride: "lowerHead" },
  legs: { at: rightEdge(LEG_R + 10, 24), ride: "legs" },
};

const payload = {
  width: W,
  height: H,
  viewDir: V.map((n) => Number(n.toFixed(6))),
  ex: unit([1, 0, 0]),
  ey: unit([0, 1, 0]),
  ez: unit([0, 0, 1]),
  pullDir: PULL_DIR.map((n) => Number(n.toFixed(6))),
  pullLining: PULL_LINING,
  pullShell: PULL_SHELL,
  recenterAssembledX,
  recenterAssembledY,
  anchors,
  items: allItems.map((it, index) => ({
    index,
    name: it.name,
    piece: it.piece,
    ride: it.ride,
    role: it.role ?? "common",
    key: Number(it.key.toFixed(2)),
    extraClass: it.extraClass || "",
    svg: it.svg,
  })),
};

const tsOut = `// Auto-generated by app/products/tanks/build-tank.mjs using Anatomy kit.
// Vertical PTFE-lined storage tank with full 360° main flange, side discharge & rigid grounded legs.
// Do not hand-edit; re-run: node app/products/tanks/build-tank.mjs --audit

export interface TankAssemblyItem {
  readonly index: number;
  readonly name: string;
  readonly piece: string;
  readonly ride: string;
  readonly role: "common" | "split" | "whole";
  readonly key: number;
  readonly extraClass: string;
  readonly svg: string;
}

export interface TankAnchor {
  readonly at: readonly [number, number];
  readonly ride: string;
}

export interface TankGeometryData {
  readonly width: number;
  readonly height: number;
  readonly viewDir: readonly [number, number, number];
  readonly ex: readonly [number, number];
  readonly ey: readonly [number, number];
  readonly ez: readonly [number, number];
  readonly pullDir: readonly [number, number, number];
  readonly pullLining: number;
  readonly pullShell: number;
  readonly recenterAssembledX: number;
  readonly recenterAssembledY: number;
  readonly anchors: Record<"top" | "lining" | "shell" | "lower" | "legs", TankAnchor>;
  readonly items: readonly TankAssemblyItem[];
}

export const TANK_GEOMETRY: TankGeometryData = ${JSON.stringify(payload, null, 2)};
`;

writeFileSync(join(HERE, "tank-geometry.generated.ts"), tsOut, "utf8");
console.log(
  `wrote tank-geometry.generated.ts (${(tsOut.length / 1024).toFixed(1)} KB, ${allItems.length} items, recenter=(${recenterAssembledX}, ${recenterAssembledY}))`,
);

A.auditOrExit(R, P);
