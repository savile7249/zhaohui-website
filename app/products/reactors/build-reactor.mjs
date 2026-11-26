import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import * as A from "../../../.agents/skills/anatomy/kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

// Isometric frame for a vertical steel-lined jacketed chemical reactor with top drive + two-stage agitator:
// - Top motor / reducer / mechanical seal lantern + internal lined shaft & two-stage impellers
// - Full 360° 36-bolt removable top head + 4 process nozzles + 2 lifting lugs
// - Full 360° main flange & bright porcelain-white flared PTFE sealing lip
// - Diagonal longitudinal cutaway showing: Outer Heat-Transfer Jacket -> Steel Shell -> White PTFE Lining -> Agitator
// - Smooth lower 2:1 ellipsoidal head + prominent front-right side discharge + stationary grounded 4-leg frame
const W = 640;
const H = 860;
const AZIMUTH = 42;
const ELEVATION = 25;

const CUT_LEFT_DEG = AZIMUTH + 90; // 132°
const CUT_RIGHT_DEG = AZIMUTH - 90; // -48°
const PULL_DEG = 104;
const PULL_DIR = [Math.cos(PULL_DEG * DEG), Math.sin(PULL_DEG * DEG), 0];

const PULL_LINING = 52;
const PULL_SHELL = 108;

// Vessel radii
const R_SHELL = 50.0;
const R_SHELL_IN = 46.5;
const R_LINER_OUT = 46.3;
const R_LINER_IN = 43.2;
const R_JACKET = 55.2; // External heating/cooling jacket outer shell
const R_JACKET_IN = 52.6;
const R_FLANGE = 58.0; // Full 360° 36-bolt main reactor flange
const R_LIP = 54.6; // Full 360° flared PTFE sealing lip

// Elevations
const Z_PAD_TOP = 2.4;
const HEAD_H = 27.0;
const Z_LOWER_BOT = 48.0;
const Z_LOWER_TOP = Z_LOWER_BOT + HEAD_H; // 75.0
const Z_JACKET_BOT = 84.0;
const Z_JACKET_TOP = 180.0;
const Z_SHELL_TOP = 205.0; // barrel 75..200, main flange 200..205
const Z_LIP_TOP = 208.0;
const Z_HEAD_FLANGE_TOP = 213.0;
const R_SEAL_HUB = 9.0;
const TOP_CUT_U = Math.sqrt(1 - (R_SEAL_HUB / R_SHELL) ** 2);
const Z_HEAD_CUT = Z_HEAD_FLANGE_TOP + HEAD_H * TOP_CUT_U; // ~239.56

// 4 tubular support legs welded rigidly to 4 square anchor plates
const LEG_R = 36;
const LEG_TUBE_R = 4.6;
const LEG_DEGS = [45, 135, 225, 315];
const lowerHeadZ = (r) => Z_LOWER_TOP - HEAD_H * Math.sqrt(Math.max(0, 1 - (r / R_SHELL) ** 2));
const LEG_SEAT_Z = 50.0; // strictly below lowerHeadZ(36 - 4.6) = 54.02

const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];

// Audited vertical explode offsets (closed-vessel vertical baseline)
const AUDIT_MOVES = {
  legs: [0, 0, 0],
  lowerHead: [0, 0, 16],
  shellBack: [0, 0, 44],
  liningBack: [0, 0, 44],
  topHead: [0, 0, 96],
  drive: [0, 0, 140],
};

const STAGGER = ["drive", "topHead", "liningBack", "shellBack", "lowerHead", "legs"];
const SPRING = { stagger: 0.04, stiffness: 64, damping: 14.2, substeps: 4 };

const pullFar = [PULL_DIR[0] * PULL_SHELL, PULL_DIR[1] * PULL_SHELL];
const P = k.fitProjection(
  [
    [-68, -68, -4],
    [74, -68, -4],
    [-68, 68, -4],
    [74, 68, -4],
    [pullFar[0] - 62, pullFar[1] - 62, 44],
    [pullFar[0] + 62, pullFar[1] + 62, 205 + 44],
    [pullFar[0] - 62, pullFar[1] + 62, 205 + 44],
    [pullFar[0] + 62, pullFar[1] - 62, 44],
    [-60, -60, 316 + AUDIT_MOVES.drive[2]],
    [60, 60, 316 + AUDIT_MOVES.drive[2]],
    [-60, 60, 316 + AUDIT_MOVES.drive[2]],
    [60, -60, 316 + AUDIT_MOVES.drive[2]],
  ],
  W - 32,
  H,
  { pad: 12, azimuth: AZIMUTH, elevation: ELEVATION },
);

const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);

const COL = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ex = (s) => [0, 0, s];

const R = A.recorder(P, {
  order: STAGGER,
  spring: SPRING,
  ground: (shape) => shape.name.startsWith("legs.plate"),
});
const { items, nameFor } = R;
const record = R.solid;

const extraItems = [];

function put(
  piece,
  auditRide,
  ref,
  svg,
  { bias = 0, shapes = [], name, extraClass = "", role = "common", runtimeRide, untracked = false, fixedKey = null } = {},
) {
  const move = AUDIT_MOVES[auditRide] ?? [0, 0, 0];
  const rRide = runtimeRide ?? auditRide;
  if (untracked) {
    extraItems.push({
      piece,
      ride: rRide,
      role,
      key: fixedKey !== null ? fixedKey : G.dot3(ref, V) + bias,
      svg,
      name: name ?? nameFor(`${piece}.extra`),
      extraClass,
    });
    return;
  }
  R.put({
    piece,
    ride: auditRide,
    runtimeRide: rRide,
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
  auditRide,
  F,
  s0,
  s1,
  r,
  style = {},
  { extra = "", inner = "", bias = 0, bevel = 0, steps, name, owner, extraClass = "", role = "common", runtimeRide, untracked = false, fixedKey = null } = {},
) {
  const facetSteps = steps ?? (r > 36 ? 52 : r > 14 ? 34 : 22);
  const paths = G.disc(s0, s1, r, F, P, { bevel, steps: facetSteps });
  const id = nameFor(name ?? `${piece}.disc`);
  const shape = untracked ? null : record(A.disc(F, s0, s1, r, { name: id, owner }));
  const mid = (s0 + s1) / 2;
  put(
    piece,
    auditRide,
    G.add3(F.o, G.mul3(F.a, mid)),
    S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra,
    { bias, name: id, shapes: shape ? [shape] : [], extraClass, role, runtimeRide, untracked, fixedKey },
  );
  return shape;
}

function flangeRing(
  piece,
  auditRide,
  z0,
  z1,
  rOut,
  { bolts = 36, boltR, topBolts = true, bevel = 0.55, tone = "hi", openBore = 0, name, bias = 0, extraClass = "", role = "common", runtimeRide } = {},
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
  return discPart(piece, auditRide, COL, z0, z1, rOut, { tone }, { bevel, extra: extraParts.join(""), bias, name: id, extraClass, role, runtimeRide });
}

function saddlePad(piece, auditRide, host, point, outward, a, h, { tone = "hi", bias = 0.3, name, owner, runtimeRide } = {}) {
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
    auditRide,
    G.add3(point, G.mul3(axis, h / 2)),
    S(G.saddleOf(F, a, start, h, P, { steps: 28 }), { tone }),
    { bias, name: id, runtimeRide, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] },
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
  runtimeRide,
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
    runtimeRide,
    [0, 0, zMid],
    S(paths, { tone, crease, inner: innerLines.length ? Ln(innerLines.join(""), { tone: "faint" }) : "" }) + extras.join(""),
    {
      name: name ?? `${piece}.${half}`,
      extraClass: `${extraClass ? `${extraClass} ` : ""}pt-tower-split-shell`,
      role: "split",
      runtimeRide,
      untracked: true,
      fixedKey: zMid * V[2] + depthOffset,
    },
  );
}

// =========================================================================
// 05. STATIONARY GROUNDED 4-LEG & SQUARE ANCHOR PLATE SUPPORT FRAME (ride = "legs", move = [0, 0, 0])
// =========================================================================

for (const deg of LEG_DEGS) {
  const rad = dir(deg);
  const cx = rad[0] * LEG_R;
  const cy = rad[1] * LEG_R;
  const padHalf = 8.4;
  const plan = { x: cx - padHalf, y: cy - padHalf, w: padHalf * 2, d: padHalf * 2, r: 0.8 };
  const padId = `legs.plate.${deg}`;
  const boltPts = k.corners(plan, 2.2).map(([bx, by]) => at([bx, by, Z_PAD_TOP]));
  put(
    "lower",
    "legs",
    [cx, cy, Z_PAD_TOP / 2],
    S(k.slabOf(plan, 0, Z_PAD_TOP, P, 2, 0.35), { tone: "mid" }) +
      Ln(k.planOutline(k.insetPlan(plan, 1.3), Z_PAD_TOP, P, 2), { tone: "faint" }) +
      Dots(boltPts, { size: 0.45, tone: "hi" }),
    { name: padId, shapes: [record(A.box([plan.x, plan.y, 0], [plan.x + plan.w, plan.y + plan.d, Z_PAD_TOP], { name: padId }))] },
  );

  const LF = G.frameOf([cx, cy, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  discPart("lower", "legs", LF, Z_PAD_TOP, Z_PAD_TOP + 3.2, LEG_TUBE_R + 1.5, { tone: "hi" }, {
    bevel: 0.2,
    name: `legs.foot.${deg}`,
  });
  discPart("lower", "legs", LF, Z_PAD_TOP + 3.2, LEG_SEAT_Z, LEG_TUBE_R, { tone: "hi" }, {
    bevel: 0.2,
    name: `legs.col.${deg}`,
    role: "split",
    extraClass: "pt-tower-split-shell",
    inner: G.arcOf(LF, Z_PAD_TOP + 18, LEG_TUBE_R, P),
  });
}

// =========================================================================
// 05. LOWER 2:1 ELLIPSOIDAL REACTOR BOTTOM HEAD, SIDE DISCHARGE NOZZLE & SEAMLESS LEG JOINTS (lowerHead)
// =========================================================================

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

const wholeLegs = [];
for (const deg of LEG_DEGS) {
  const rad = dir(deg);
  const cx = rad[0] * LEG_R;
  const cy = rad[1] * LEG_R;
  const DF = G.frameOf([cx, cy, 0], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const startFn = (angle) => {
    const px = cx + Math.cos(angle) * LEG_TUBE_R;
    const py = cy - Math.sin(angle) * LEG_TUBE_R;
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
    S(G.saddleOf(DF, LEG_TUBE_R, startFn, endS, P, { steps: 28 }), { tone: "hi" }),
    {
      name: id,
      role: "split",
      extraClass: "pt-tower-split-shell",
      shapes: [record(A.disc(DF, lowS - 0.05, endS, LEG_TUBE_R, { name: id, seated: true, cut: [lowerHeadShape] }))],
    },
  );
  wholeLegs.push({
    deg,
    padId: id,
    svg: S(G.saddleOf(DF, LEG_TUBE_R, startFn, -(Z_PAD_TOP + 3.2), P, { steps: 28 }), { tone: "hi" }),
  });
}

// Prominent Front-Right Side Discharge Nozzle on lower head flank (deg = -10°, z = 65)
{
  const OUTLET_DEG = -10;
  const OUTLET_Z = 65.0;
  const OUTLET_R = lowerHeadRadius(OUTLET_Z);
  const outward = dir(OUTLET_DEG);
  const neckR = 4.4;
  const flangeR = 8.0;
  const neckLen = 15.0;
  const pt = [outward[0] * OUTLET_R, outward[1] * OUTLET_R, OUTLET_Z];
  const pad = saddlePad("lower", "lowerHead", lowerHeadShape, pt, outward, neckR, neckLen, {
    tone: "hi",
    name: "lower.outlet-neck",
  });
  const OF = G.frameAlong(pad.face, pad.axis);
  const flangeT = 2.4;
  const bore = G.circleOf(OF, flangeT, 3.2, P, 24);
  discPart("lower", "lowerHead", OF, 0, flangeT, flangeR, { tone: "hi" }, {
    bevel: 0.25,
    bias: 0.3,
    name: "lower.outlet-flange",
    owner: "lower.outlet-neck",
    extra:
      `<path class="pt-tower-void" d="${bore}"/>` +
      Ln(bore, { tone: "mid" }) +
      Dots(G.dotsOf(OF, flangeT, flangeR * 0.78, 8, P, { all: true }), { size: 0.4, tone: "mid" }),
  });
  const lipBore = G.circleOf(OF, flangeT + 1.2, 3.2, P, 24);
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
// 04 & 03. PRESSURE SHELL, EXTERNAL HEAT-TRANSFER JACKET & WHITE PTFE INNER LINING
// - Full 360° 36-bolt main flange & full 360° white flared PTFE lip stay intact
// - Straight barrel + outer heating/cooling jacket split diagonally to expose the 3-layer cutaway + center agitator
// =========================================================================

// Audited seamless 360° whole shell + outer heat-transfer jacket (fades in at 88%..94%)
discPart("shell", "shellBack", COL, Z_LOWER_TOP, Z_JACKET_BOT, R_SHELL, { tone: "hi" }, {
  name: "shell.whole-bot",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
});
const jacketWholeShape = discPart("shell", "shellBack", COL, Z_JACKET_BOT, Z_JACKET_TOP, R_JACKET, { tone: "hi" }, {
  bevel: 0.45,
  name: "shell.jacket-whole",
  inner: [114, 150].map((zs) => G.arcOf(COL, zs, R_JACKET, P)).join(""),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
});
discPart("shell", "shellBack", COL, Z_JACKET_TOP, 200, R_SHELL, { tone: "hi" }, {
  name: "shell.whole-top",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
});

// Two jacket heating/cooling medium nozzles on the front jacket wall (deg = +58°, riding with shellFront!)
for (const [tag, zJ] of [
  ["in", 102],
  ["out", 162],
]) {
  const outward = dir(58);
  const pt = [outward[0] * R_JACKET, outward[1] * R_JACKET, zJ];
  const pad = saddlePad("shell", "shellBack", jacketWholeShape, pt, outward, 3.2, 7.5, {
    tone: "hi",
    bias: 6.5,
    name: `shell.jacket-${tag}-neck`,
    runtimeRide: "shellFront",
  });
  const JF = G.frameAlong(pad.face, pad.axis);
  const bore = G.circleOf(JF, 2.0, 2.1, P, 20);
  discPart("shell", "shellBack", JF, 0, 2.0, 5.6, { tone: "hi" }, {
    bevel: 0.2,
    bias: 6.6,
    name: `shell.jacket-${tag}-flange`,
    owner: `shell.jacket-${tag}-neck`,
    runtimeRide: "shellFront",
    extra:
      `<path class="pt-tower-void" d="${bore}"/>` +
      Ln(bore, { tone: "mid" }) +
      Dots(G.dotsOf(JF, 2.0, 4.3, 4, P, { all: true }), { size: 0.35, tone: "mid" }),
  });
}

// FULL 360° 36-bolt top main flange & FULL 360° bright white flared PTFE sealing lip
flangeRing("shell", "shellBack", 200, Z_SHELL_TOP, R_FLANGE, {
  bolts: 36,
  boltR: R_FLANGE - 3.2,
  openBore: R_LINER_IN,
  bevel: 0.55,
  name: "shell.flange-top",
  role: "common",
});
flangeRing("lining", "liningBack", Z_SHELL_TOP, Z_LIP_TOP, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  openBore: R_LINER_IN,
  tone: "hi",
  name: "lining.lip-main",
  extraClass: "pt-tower-lining-lip",
  role: "common",
});

// Diagonal Split-Shell Cutaway Halves (strictly ordered back -> front):
// 1a) Back outer heat-transfer jacket half (depthOffset: -8.5)
splitRingPart("shell", "shellBack", "back", Z_JACKET_BOT, Z_JACKET_TOP, R_JACKET, R_JACKET_IN, {
  name: "shell.jacket-back",
  depthOffset: -8.5,
  seamZs: [114, 150],
});
// 1b) Back pressure steel wall (depthOffset: -6.0)
splitRingPart("shell", "shellBack", "back", Z_LOWER_TOP, 200, R_SHELL, R_SHELL_IN, {
  name: "shell.back",
  depthOffset: -6.0,
  seamZs: [114, 150],
});
// 2) Back continuous white PTFE inner liner wall (depthOffset: -2.8)
splitRingPart("lining", "liningBack", "back", Z_LOWER_TOP, 200, R_LINER_OUT, R_LINER_IN, {
  name: "lining.back",
  depthOffset: -2.8,
  seamZs: [114, 150],
  extraClass: "pt-tower-lining-sleeve",
  cutOutlineTone: "hi",
});
// 3) Front continuous white PTFE inner liner wall (depthOffset: +2.2, pulls diagonally to PULL_LINING)
splitRingPart("lining", "liningFront", "front", Z_LOWER_TOP, 200, R_LINER_OUT, R_LINER_IN, {
  name: "lining.front",
  depthOffset: 2.2,
  seamZs: [114, 150],
  extraClass: "pt-tower-lining-sleeve",
});
// 4a) Front pressure steel wall (depthOffset: +5.0, pulls diagonally to PULL_SHELL)
splitRingPart("shell", "shellFront", "front", Z_LOWER_TOP, 200, R_SHELL, R_SHELL_IN, {
  name: "shell.front",
  depthOffset: 5.0,
  seamZs: [114, 150],
});
// 4b) Front outer heat-transfer jacket half (depthOffset: +9.2 so zMid*V[2]+9.2 = 65.0 > shell.front 63.1)
splitRingPart("shell", "shellFront", "front", Z_JACKET_BOT, Z_JACKET_TOP, R_JACKET, R_JACKET_IN, {
  name: "shell.jacket-front",
  depthOffset: 9.2,
  seamZs: [114, 150],
});

// =========================================================================
// 01 (Internal). CENTER LINED AGITATOR SHAFT & TWO-STAGE IMPELLERS (centered inside white PTFE cavity!)
// All internal agitator parts anchor fixedKey strictly around Z_BARREL_MID * V[2] (58.11)
// so they ALWAYS stay strictly between lining.back (55.31) and lining.front (60.31) when seated!
// =========================================================================
{
  const Z_SHAFT_BOT = 96;
  const Z_SHAFT_TOP = 204;
  const BARREL_MID_KEY = ((Z_LOWER_TOP + 200) * 0.5) * V[2];

  // Vertical lined agitator shaft
  discPart("drive", "drive", COL, Z_SHAFT_BOT, Z_SHAFT_TOP, 2.8, { tone: "hi" }, {
    name: "drive.shaft",
    role: "split",
    untracked: true,
    extraClass: "pt-tower-internal pt-tower-split-shell",
    fixedKey: BARREL_MID_KEY,
  });

  // Two-tier 4-blade pitched turbine impellers (lower r = 29 at z = 108, upper r = 25 at z = 158)
  for (const [tier, zImp, bladeLen, degOffset, tierBias] of [
    ["lower", 108, 29, 15, -0.55],
    ["upper", 158, 25, 60, 0.45],
  ]) {
    // Central impeller hub collar
    discPart("drive", "drive", COL, zImp - 4.5, zImp + 4.5, 5.4, { tone: "hi" }, {
      bevel: 0.25,
      name: `drive.hub-${tier}`,
      role: "split",
      untracked: true,
      extraClass: "pt-tower-internal pt-tower-split-shell",
      fixedKey: BARREL_MID_KEY + tierBias + 0.05,
    });
    // 4 radial blades built cleanly via prismOf
    for (let b = 0; b < 4; b++) {
      const aDeg = degOffset + b * 90;
      const rad = dir(aDeg);
      const tan = [-rad[1], rad[0], 0];
      const BF = G.frameOf([0, 0, zImp], tan, rad, [0, 0, 1]);
      const bladePoly = [
        [4.8, -3.4],
        [bladeLen, -2.6],
        [bladeLen, 2.6],
        [4.8, 3.4],
      ];
      const midPt = [rad[0] * (bladeLen * 0.55), rad[1] * (bladeLen * 0.55), zImp];
      const depthNudge = G.dot3([rad[0], rad[1], 0], V) * 0.3;
      put("drive", "drive", midPt, S(G.prismOf(BF, bladePoly, -1.0, 1.0, P), { tone: "hi" }), {
        name: `drive.blade-${tier}-${b}`,
        role: "split",
        untracked: true,
        extraClass: "pt-tower-internal pt-tower-split-shell",
        fixedKey: BARREL_MID_KEY + tierBias + depthNudge,
      });
    }
  }
}

// =========================================================================
// 02. FULL 360° REMOVABLE 36-BOLT TOP HEAD, 4 PROCESS NOZZLES & 2 LIFTING LUGS (topHead)
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
  const u = Math.max(0, Math.min(TOP_CUT_U, (s - Z_HEAD_FLANGE_TOP) / HEAD_H));
  return R_SHELL * Math.sqrt(Math.max(0, 1 - u * u));
};
const topHeadSlope = (s) => {
  const u = Math.max(0, Math.min(TOP_CUT_U, (s - Z_HEAD_FLANGE_TOP) / HEAD_H));
  return (-R_SHELL * u) / (HEAD_H * Math.sqrt(Math.max(1e-5, 1 - u * u)));
};
const topHeadProfile = Array.from({ length: 21 }, (_, idx) => {
  const t = idx / 20;
  const u = TOP_CUT_U * Math.sin(t * (Math.PI / 2));
  const s = Z_HEAD_FLANGE_TOP + HEAD_H * u;
  return [s, topHeadRadius(s), idx > 0 && idx < 20 ? 1 : 0];
});
const topHeadShape = record(A.solid(COL, topHeadProfile, { name: "top.head", radius: topHeadRadius }));
put(
  "top",
  "topHead",
  ex((Z_HEAD_FLANGE_TOP + Z_HEAD_CUT) / 2),
  S(G.solidOf(topHeadProfile, COL, P, { steps: 52, smooth: { slope: topHeadSlope, rows: 4 } }), {
    tone: "hi",
    inner: Ln(
      [0.36, 0.7].map((u) => G.arcOf(COL, Z_HEAD_FLANGE_TOP + HEAD_H * u, topHeadRadius(Z_HEAD_FLANGE_TOP + HEAD_H * u), P, { slope: topHeadSlope(Z_HEAD_FLANGE_TOP + HEAD_H * u) })).join(""),
      { tone: "faint" },
    ),
  }),
  { name: "top.head", bias: 6.0, shapes: [topHeadShape] },
);

// 4 Vertical process nozzles surrounding the central agitator seal hub (r = 30)
const NOZZLE_TOP_Z = Z_HEAD_CUT + 9.0;
for (const nz of [
  { id: "n1", deg: -15, rNeck: 3.4, rFlange: 6.4 }, // feed manway / large inlet
  { id: "n2", deg: 80, rNeck: 2.6, rFlange: 5.2 },
  { id: "n3", deg: 170, rNeck: 2.6, rFlange: 5.2 },
  { id: "n4", deg: 265, rNeck: 2.6, rFlange: 5.2 },
]) {
  const rad = dir(nz.deg);
  const nx = rad[0] * 30;
  const ny = rad[1] * 30;
  const domeZ = Z_HEAD_FLANGE_TOP + HEAD_H * Math.sqrt(1 - (30 / R_SHELL) ** 2);
  const NF = G.frameOf([nx, ny, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const startFn = (angle) => {
    const px = nx + Math.cos(angle) * nz.rNeck;
    const py = ny + Math.sin(angle) * nz.rNeck;
    const rr = Math.min(R_SHELL - 0.5, Math.hypot(px, py));
    return Z_HEAD_FLANGE_TOP + HEAD_H * Math.sqrt(Math.max(0, 1 - (rr / R_SHELL) ** 2));
  };
  const lowZ = Math.min(...Array.from({ length: 32 }, (_, i) => startFn((i / 32) * Math.PI * 2)));
  const neckTop = NOZZLE_TOP_Z - 2.2;
  put("top", "topHead", [nx, ny, (domeZ + neckTop) / 2], S(G.saddleOf(NF, nz.rNeck, startFn, neckTop, P, { steps: 24 }), { tone: "hi" }), {
    bias: 6.2,
    name: `top.${nz.id}-neck`,
    shapes: [record(A.disc(NF, lowZ - 0.05, neckTop, nz.rNeck, { name: `top.${nz.id}-neck`, seated: true, cut: [topHeadShape] }))],
  });
  const bore = G.circleOf(NF, NOZZLE_TOP_Z, nz.rNeck - 0.7, P, 20);
  discPart("top", "topHead", NF, neckTop, NOZZLE_TOP_Z, nz.rFlange, { tone: "hi" }, {
    bevel: 0.2,
    bias: 6.2,
    name: `top.${nz.id}-flange`,
    owner: `top.${nz.id}-neck`,
    extra:
      `<path class="pt-tower-void" d="${bore}"/>` +
      Ln(bore, { tone: "mid" }) +
      Dots(G.dotsOf(NF, NOZZLE_TOP_Z, nz.rFlange * 0.76, 4, P, { all: true }), { size: 0.35, tone: "mid" }),
  });
  discPart("lining", "topHead", NF, NOZZLE_TOP_Z, NOZZLE_TOP_Z + 0.9, nz.rFlange * 0.78, { tone: "hi" }, {
    bevel: 0.12,
    bias: 6.3,
    name: `top.${nz.id}-lip`,
    owner: `top.${nz.id}-neck`,
    extraClass: "pt-tower-lining-lip",
    extra: `<path class="pt-tower-void" d="${G.circleOf(NF, NOZZLE_TOP_Z + 0.9, nz.rNeck - 0.7, P, 20)}"/>`,
  });
}

// 2 Forged lifting lugs on top head flange
for (const lugDeg of [118, 298]) {
  const rad = dir(lugDeg);
  const tan = [-rad[1], rad[0], 0];
  const lugR = 54.0;
  const LF = G.frameOf([rad[0] * lugR, rad[1] * lugR, Z_HEAD_FLANGE_TOP], tan, rad, [0, 0, 1]);
  const lugPoly = [
    [-3.2, 0],
    [3.2, 0],
    [2.4, 8.2],
    [0, 10.6],
    [-2.4, 8.2],
  ];
  const id = `top.lug.${lugDeg}`;
  put(
    "top",
    "topHead",
    [rad[0] * lugR, rad[1] * lugR, Z_HEAD_FLANGE_TOP + 5.2],
    S(G.prismOf(LF, lugPoly, -1.0, 1.0, P), { tone: "mid" }) +
      Dots([at([rad[0] * lugR, rad[1] * lugR, Z_HEAD_FLANGE_TOP + 6.8])], { size: 0.52, tone: "hi" }),
    { name: id, bias: 6.2, shapes: [record(A.prism(LF, lugPoly, -1.0, 1.0, { name: id, owner: "top.flange-bottom" }))] },
  );
}

// =========================================================================
// 01 (External). TOP-MOUNTED MECHANICAL SEAL, LANTERN BRACKET, REDUCER & DRIVE MOTOR (drive)
// =========================================================================

// Seal mounting base flange on top head crown
flangeRing("drive", "drive", Z_HEAD_CUT, Z_HEAD_CUT + 3.2, 12.8, {
  bolts: 8,
  boltR: 10.4,
  bevel: 0.3,
  bias: 6.5,
  name: "drive.seal-flange",
});
// Mechanical seal cartridge housing
discPart("drive", "drive", COL, Z_HEAD_CUT + 3.2, Z_HEAD_CUT + 13.5, R_SEAL_HUB, { tone: "hi" }, {
  bevel: 0.25,
  bias: 6.5,
  name: "drive.seal-body",
  inner: G.arcOf(COL, Z_HEAD_CUT + 8.5, R_SEAL_HUB, P),
});
// Lantern coupling stand
discPart("drive", "drive", COL, Z_HEAD_CUT + 13.5, Z_HEAD_CUT + 28.5, 7.2, { tone: "mid" }, {
  bevel: 0.2,
  bias: 6.5,
  name: "drive.lantern",
  inner: G.arcOf(COL, Z_HEAD_CUT + 21, 7.2, P),
});
// Planetary / helical gear reducer housing
discPart("drive", "drive", COL, Z_HEAD_CUT + 28.5, Z_HEAD_CUT + 46.5, 13.4, { tone: "hi" }, {
  bevel: 0.55,
  bias: 6.5,
  name: "drive.reducer",
  inner: G.arcOf(COL, Z_HEAD_CUT + 37.5, 13.4, P),
});
// Vertical electric motor with axial cooling fins + fan cowl
{
  const zM0 = Z_HEAD_CUT + 46.5;
  const zM1 = Z_HEAD_CUT + 71.5;
  const finLines = Faded(G.ribsOf(COL, zM0 + 2, zM1 - 2, 10.4, 24, P, { fade: [0.15, 0.55], seams: true }), { tone: "mid" });
  discPart("drive", "drive", COL, zM0, zM1, 10.4, { tone: "hi" }, {
    bevel: 0.3,
    bias: 6.5,
    name: "drive.motor",
    extra: finLines,
  });
  discPart("drive", "drive", COL, zM1, zM1 + 5.5, 9.6, { tone: "mid" }, {
    bevel: 0.5,
    bias: 6.5,
    name: "drive.motor-cap",
  });
}

// =========================================================================
// SETTLE DEPTH KEYS & RUN GEOMETRY AUDIT
// =========================================================================

A.settle(R, P);

for (const wl of wholeLegs) {
  const padItem = items.find((it) => it.name === wl.padId);
  extraItems.push({
    piece: "lower",
    ride: "legs",
    role: "whole",
    key: padItem ? padItem.key : 0,
    svg: wl.svg,
    name: `legs.whole.${wl.deg}`,
    extraClass: "pt-tower-whole-shell",
  });
}

const exportedItems = [
  ...items.map((it) => ({
    name: it.name,
    piece: it.piece,
    ride: it.runtimeRide ?? it.ride,
    role: it.role ?? "common",
    key: it.key,
    extraClass: it.extraClass || "",
    svg: it.svg,
  })),
  ...extraItems.map((it) => ({
    name: it.name,
    piece: it.piece,
    ride: it.ride,
    role: it.role ?? "common",
    key: it.key,
    extraClass: it.extraClass || "",
    svg: it.svg,
  })),
].sort((a, b) => a.key - b.key);

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [Number((p[0] - o[0]).toFixed(4)), Number((p[1] - o[1]).toFixed(4))];
};

const assembledCenter = at([0, 0, (Z_HEAD_CUT + 77) / 2]);
const recenterAssembledX = Number((W * 0.5 - assembledCenter[0]).toFixed(1));
const recenterAssembledY = Number((H * 0.5 - assembledCenter[1]).toFixed(1));

const rightEdge = (r, z) => {
  const rad = dir(CUT_RIGHT_DEG);
  const pt = at([rad[0] * r, rad[1] * r, z]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
};

const outletAnchor = (() => {
  const rad = dir(-10);
  const pt = at([rad[0] * (lowerHeadRadius(65.0) + 18.5), rad[1] * (lowerHeadRadius(65.0) + 18.5), 65.0]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
})();

const anchors = {
  drive: { at: rightEdge(13.8, Z_HEAD_CUT + 38), ride: "drive" },
  top: { at: rightEdge(R_FLANGE, Z_HEAD_FLANGE_TOP + 6), ride: "topHead" },
  lining: { at: rightEdge(R_LINER_OUT, 148), ride: "liningBack" },
  shell: { at: rightEdge(R_JACKET, 134), ride: "shellBack" },
  lower: { at: outletAnchor, ride: "lowerHead" },
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
  items: exportedItems.map((it, index) => ({
    index,
    name: it.name,
    piece: it.piece,
    ride: it.ride,
    role: it.role,
    key: Number(it.key.toFixed(2)),
    extraClass: it.extraClass,
    svg: it.svg,
  })),
};

const tsOut = `// Auto-generated by app/products/reactors/build-reactor.mjs using Anatomy kit.
// Steel-lined jacketed chemical reactor with agitator & diagonal longitudinal cutaway (schematic, non-proportional).
// Do not hand-edit; re-run: node app/products/reactors/build-reactor.mjs --audit

export interface ReactorAssemblyItem {
  readonly index: number;
  readonly name: string;
  readonly piece: string;
  readonly ride: string;
  readonly role: "common" | "split" | "whole";
  readonly key: number;
  readonly extraClass: string;
  readonly svg: string;
}

export interface ReactorAnchor {
  readonly at: readonly [number, number];
  readonly ride: string;
}

export interface ReactorGeometryData {
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
  readonly anchors: Record<"drive" | "top" | "lining" | "shell" | "lower", ReactorAnchor>;
  readonly items: readonly ReactorAssemblyItem[];
}

export const REACTOR_GEOMETRY: ReactorGeometryData = ${JSON.stringify(payload, null, 2)};
`;

writeFileSync(join(HERE, "reactor-geometry.generated.ts"), tsOut, "utf8");
console.log(
  `wrote reactor-geometry.generated.ts (${(tsOut.length / 1024).toFixed(1)} KB, ${exportedItems.length} items, recenter=(${recenterAssembledX}, ${recenterAssembledY}))`,
);

A.auditOrExit(R, P);
