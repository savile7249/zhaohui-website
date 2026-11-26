import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../.agents/skills/anatomy/kit/tube.mjs";
import * as A from "../../../.agents/skills/anatomy/kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

// Isometric frame for a tall 3-section PTFE/PO-lined packed scrubbing column
// Upgraded with diagonal longitudinal split-shell cutaway revealing full-height bright inner lining
// plus demister, tree-shaped spray distributor, packing bed & perforated plates inside the open trough.
const W = 640;
const H = 860;
const AZIMUTH = 42;
const ELEVATION = 24;

// Split plane perpendicular to horizontal view direction (AZIMUTH = 42°):
// Back half: [132°, 312°] (concave inner lining wall + wall-thickness cut faces face viewer directly)
// Front half: [-48°, 132°] (convex outer steel shell + ALL front manways & nozzles pull front-left along 104°)
const CUT_LEFT_DEG = AZIMUTH + 90; // 132°
const CUT_RIGHT_DEG = AZIMUTH - 90; // -48°
const PULL_DEG = 104;
const PULL_DIR = [Math.cos(PULL_DEG * DEG), Math.sin(PULL_DEG * DEG), 0];

const PULL_LINING = 40; // Front PTFE/PO inner liner halves hover cleanly mid-left
const PULL_SHELL = 82; // Front steel shell halves + manways/nozzles hover cleanly far-left

// Column radii (crisp readable steel wall + continuous PTFE/PO lining wall + internals inside)
const R_SHELL = 30.0;
const R_SHELL_IN = 27.4; // Steel wall thickness = 2.6
const R_LINER_OUT = 27.2; // Continuous PTFE/PO lining outer radius
const R_LINER_IN = 25.0; // Continuous PTFE/PO lining inner wall (thickness = 2.2)
const R_FLANGE = 36.0;
const R_LIP = 33.6;
const R_BASE = 34.5;
const R_INT = 24.4; // Demister / spray / packing / perforated plates fit strictly inside R_LINER_IN

// Assembled Z elevations (3 flanged sections + flat base plate + 2:1 ellipsoidal top head + N2 90° outlet elbow)
const Z_BASE_BOT = 0;
const Z_BASE_TOP = 4;
const Z_LOWER_TOP = 108;
const Z_LIP1_TOP = 110.5;
const Z_MID_TOP = 204;
const Z_LIP2_TOP = 206.5;
const Z_UPPER_TOP = 326;
const Z_LIP3_TOP = 328.5;
const HEAD_Z0 = Z_LIP3_TOP + 4.5; // 333
const HEAD_H = 16;
const R_OUTLET = 6.2;
const HEAD_CUT_U = Math.sqrt(1 - (R_OUTLET / R_SHELL) ** 2);
const Z_HEAD_CUT = HEAD_Z0 + HEAD_H * HEAD_CUT_U;

// Compass rotation (all front manways & nozzles land cleanly on the front half [-48°, +132°]!):
// CAD 90° (M1/M3/M5/N1) -> -24°; CAD 180° (M2/M4/N4a/N4b/N5a/N5b) -> +66°; CAD 225° (N7) -> +111°
const cadDeg = (deg) => deg - 114;
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];

// Audited vertical explode offsets (closed-vessel vertical baseline)
const AUDIT_MOVES = {
  base: [0, 0, 0],
  lower: [0, 0, 14],
  packing: [0, 0, 34],
  midSection: [0, 0, 62],
  spray: [0, 0, 82],
  upperSection: [0, 0, 108],
  demister: [0, 0, 128],
  topHead: [0, 0, 158],
};

const STAGGER = ["topHead", "upperSection", "midSection", "packing", "lower", "base"];
const SPRING = { stagger: 0.04, stiffness: 64, damping: 14.2, substeps: 4 };

const pullFar = [PULL_DIR[0] * PULL_SHELL, PULL_DIR[1] * PULL_SHELL];
const P = k.fitProjection(
  [
    [-54, -54, -4],
    [54, -54, -4],
    [-54, 54, -4],
    [54, 54, -4],
    [pullFar[0] - 46, pullFar[1] - 46, 14],
    [pullFar[0] + 46, pullFar[1] + 46, Z_UPPER_TOP + AUDIT_MOVES.upperSection[2]],
    [pullFar[0] - 46, pullFar[1] + 46, Z_UPPER_TOP + AUDIT_MOVES.upperSection[2]],
    [pullFar[0] + 46, pullFar[1] - 46, 14],
    [-50, -50, Z_HEAD_CUT + 26 + AUDIT_MOVES.topHead[2]],
    [50, 50, Z_HEAD_CUT + 26 + AUDIT_MOVES.topHead[2]],
    [-50, 50, Z_HEAD_CUT + 26 + AUDIT_MOVES.topHead[2]],
    [50, -50, Z_HEAD_CUT + 26 + AUDIT_MOVES.topHead[2]],
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

// Structural audit recorder (audits every external closed-vessel solid, saddle nozzle, davit, lug & N2 elbow)
const R = A.recorder(P, {
  order: STAGGER,
  spring: SPRING,
  ground: (shape) => shape.name === "base.plate",
});
const { items, nameFor } = R;
const record = R.solid;

// Split cutaway & centered internal items (strictly ordered backShell -> backLining -> internals -> frontLining -> frontShell)
const extraItems = [];

function put(
  piece,
  auditRide,
  ref,
  svg,
  {
    bias = 0,
    shapes = [],
    name,
    route,
    chunk,
    extraClass = "",
    role = "common",
    runtimeRide,
    untracked = false,
    fixedKey = null,
  } = {},
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
    route,
    chunk,
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
  const facetSteps = steps ?? (r > 26 ? 48 : r > 12 ? 32 : 22);
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
  { bolts = 20, boltR, topBolts = true, bevel = 0.5, tone = "hi", openBore = 0, name, bias = 0, extraClass = "", role = "common", runtimeRide } = {},
) {
  const id = nameFor(name ?? `${piece}.flange`);
  const extraParts = [];
  if (openBore > 0) {
    const voidPath = G.circleOf(COL, z1, openBore, P, 48);
    extraParts.push(`<path class="pt-tower-void" d="${voidPath}"/>`);
    extraParts.push(Ln(voidPath, { tone: "mid" }));
    extraParts.push(Ln(G.arcOf(COL, z1, openBore, P, { inward: true, least: -1, steps: 48 }), { tone: "faint" }));
  }
  if (topBolts && bolts > 0) {
    extraParts.push(Dots(G.dotsOf(COL, z1, boltR ?? rOut - 3.2, bolts, P, { all: true }), { size: 0.42, tone: "mid" }));
  }
  return discPart(piece, auditRide, COL, z0, z1, rOut, { tone }, { bevel, extra: extraParts.join(""), bias, name: id, extraClass, role, runtimeRide });
}

// C-ring annular half-cylinder helper for diagonal split-shell cutaway
function cRing(rOut, rIn, aStartDeg, aEndDeg, steps = 28) {
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

function arcLine(r, aStartDeg, aEndDeg, z, steps = 24) {
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
  {
    tone = "hi",
    crease = "faint",
    extraClass = "",
    name,
    depthOffset = 0,
    seamZs = [],
    bolts = 0,
    boltR = 0,
    cutOutlineTone = "mid",
    steps = 28,
  } = {},
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
      innerLines.push(arcLine(rIn, a0, a1, zs, 24));
    }
  } else {
    for (const zs of seamZs) {
      innerLines.push(arcLine(rOut, a0, a1, zs, 24));
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

  if (bolts > 0) {
    const pts = [];
    const rB = boltR || (rOut + rIn) * 0.5;
    for (let i = 0; i < bolts; i++) {
      const a = (a0 + ((i + 0.5) / bolts) * (a1 - a0)) * DEG;
      pts.push(at([Math.cos(a) * rB, Math.sin(a) * rB, z1]));
    }
    extras.push(Dots(pts, { size: 0.4, tone: "mid" }));
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

// Helper to emit back + front split C-ring steel shell + back + front continuous PTFE/PO lining for one straight tower section
function emitSplitSection({
  piece,
  backRide,
  frontRide,
  liningBackRide,
  liningFrontRide,
  zBot,
  zTop,
  zLipTop,
  bottomFlange = false,
  seamZs = [],
  prefix,
}) {
  const shellZ0 = bottomFlange ? zBot + 4.5 : zBot;
  const shellZ1 = zTop - 4.5;

  // 1) Back steel shell & back flanges (depthOffset: -6.0)
  if (bottomFlange) {
    splitRingPart(piece, backRide, "back", zBot, shellZ0, R_FLANGE, R_SHELL_IN, {
      name: `${prefix}.flange-bottom-back`,
      depthOffset: -6.0,
    });
  }
  splitRingPart(piece, backRide, "back", shellZ0, shellZ1, R_SHELL, R_SHELL_IN, {
    name: `${prefix}.shell-back`,
    depthOffset: -6.0,
    seamZs,
  });
  splitRingPart(piece, backRide, "back", shellZ1, zTop, R_FLANGE, R_SHELL_IN, {
    name: `${prefix}.flange-top-back`,
    depthOffset: -6.0,
    bolts: 12,
    boltR: R_FLANGE - 3.2,
  });

  // 2) Back continuous PTFE/PO inner lining & back flared flange lip (depthOffset: -2.8)
  splitRingPart("lining", liningBackRide, "back", zBot, zTop, R_LINER_OUT, R_LINER_IN, {
    name: `${prefix}.lining-back`,
    depthOffset: -2.8,
    seamZs,
    extraClass: "pt-tower-lining-sleeve",
    cutOutlineTone: "hi",
  });
  splitRingPart("lining", liningBackRide, "back", zTop, zLipTop, R_LIP, R_LINER_IN, {
    name: `${prefix}.lip-back`,
    depthOffset: -2.6,
    extraClass: "pt-tower-lining-lip",
    cutOutlineTone: "hi",
  });

  // 3) Front continuous PTFE/PO inner lining & front flared flange lip (depthOffset: +2.2 / lip +5.3)
  splitRingPart("lining", liningFrontRide, "front", zBot, zTop, R_LINER_OUT, R_LINER_IN, {
    name: `${prefix}.lining-front`,
    depthOffset: 2.2,
    seamZs,
    extraClass: "pt-tower-lining-sleeve",
  });
  splitRingPart("lining", liningFrontRide, "front", zTop, zLipTop, R_LIP, R_LINER_IN, {
    name: `${prefix}.lip-front`,
    depthOffset: 5.3,
    extraClass: "pt-tower-lining-lip",
  });

  // 4) Front steel shell & front flanges (depthOffset: +5.0)
  if (bottomFlange) {
    splitRingPart(piece, frontRide, "front", zBot, shellZ0, R_FLANGE, R_SHELL_IN, {
      name: `${prefix}.flange-bottom-front`,
      depthOffset: 5.0,
    });
  }
  splitRingPart(piece, frontRide, "front", shellZ0, shellZ1, R_SHELL, R_SHELL_IN, {
    name: `${prefix}.shell-front`,
    depthOffset: 5.0,
    seamZs,
  });
  splitRingPart(piece, frontRide, "front", shellZ1, zTop, R_FLANGE, R_SHELL_IN, {
    name: `${prefix}.flange-top-front`,
    depthOffset: 5.0,
    bolts: 12,
    boltR: R_FLANGE - 3.2,
  });
}

function saddlePad(piece, auditRide, host, point, outward, a, h, { tone = "hi", bias = 2.0, name, owner, ring = false, runtimeRide } = {}) {
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
  const face = ring && G.dot3(axis, V) > 0.15 ? Ln(G.circleOf(F, h, a * 0.62, P, 18), { tone: "faint" }) : "";
  put(
    piece,
    auditRide,
    G.add3(point, G.mul3(axis, h / 2)),
    S(G.saddleOf(F, a, start, h, P, { steps: 28 }), { tone }) + face,
    {
      bias,
      name: id,
      runtimeRide,
      shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))],
    },
  );
  return { face: G.add3(point, G.mul3(axis, h)), axis, F };
}

// Radial flanged nozzle mounted on the front half shell (rides with frontRide when split!)
function sideNozzle(
  piece,
  auditRide,
  runtimeRide,
  host,
  worldAngleDeg,
  z,
  neckR,
  flangeR,
  length,
  { bolts = 8, blind = false, openBore = 0, name, tone = "hi", flaredLip = true, davit = false } = {},
) {
  const outward = dir(worldAngleDeg);
  const pt = [outward[0] * R_SHELL, outward[1] * R_SHELL, z];
  const pad = saddlePad(piece, auditRide, host, pt, outward, neckR, length * 0.65, {
    tone,
    name: `${name}.neck`,
    runtimeRide,
  });
  const F = G.frameAlong(pad.face, pad.axis);
  const thick = Math.max(1.8, flangeR * 0.24);
  const faceS = thick;
  const extras = [];
  if (G.dot3(F.a, V) > 0.12) {
    if (openBore > 0 && !blind) {
      const bore = G.circleOf(F, faceS, openBore, P, 24);
      extras.push(`<path class="pt-tower-void" d="${bore}"/>`);
      extras.push(Ln(bore, { tone: "mid" }));
    }
    if (bolts > 0) {
      extras.push(Dots(G.dotsOf(F, faceS, flangeR * 0.78, bolts, P, { all: true }), { size: 0.38, tone: "mid" }));
    }
    if (blind) {
      const rBar = flangeR * 0.48;
      const b1 = G.add3(G.add3(pad.face, G.mul3(F.a, faceS + 0.05)), G.mul3(F.u, -rBar * 0.52));
      const b2 = G.add3(G.add3(pad.face, G.mul3(F.a, faceS + 0.05)), G.mul3(F.u, rBar * 0.52));
      extras.push(
        Ln(
          k.segment(G.add3(b1, G.mul3(F.v, -rBar * 0.55)), G.add3(b1, G.mul3(F.v, rBar * 0.55)), P) +
            k.segment(G.add3(b2, G.mul3(F.v, -rBar * 0.55)), G.add3(b2, G.mul3(F.v, rBar * 0.55)), P),
          { tone: "mid", free: true },
        ),
      );
    }
  }
  discPart(piece, auditRide, F, 0, thick, flangeR, { tone }, {
    bevel: 0.25,
    bias: 2.0,
    extra: extras.join(""),
    name: `${name}.flange`,
    owner: `${name}.neck`,
    runtimeRide,
  });

  if (flaredLip && !blind) {
    discPart("lining", auditRide, F, thick, thick + 1.1, flangeR * 0.84, { tone: "hi" }, {
      bevel: 0.15,
      bias: 2.1,
      name: `${name}.lip`,
      owner: `${name}.neck`,
      extraClass: "pt-tower-lining-lip",
      runtimeRide,
    });
  }

  if (davit) {
    const tan = [-outward[1], outward[0], 0];
    const radialReach = length * 0.65 + thick * 0.5;
    const hingeTop = [outward[0] * R_SHELL, outward[1] * R_SHELL, z + flangeR + 4.2];
    const davitPad = saddlePad(piece, auditRide, host, hingeTop, outward, 2.0, radialReach, {
      tone: "mid",
      name: `${name}.davit-boss`,
      runtimeRide,
    });
    const ballR = 1.9;
    const topBallC = G.add3(davitPad.face, G.mul3(outward, Math.sqrt(ballR * ballR - 1.5 * 1.5)));
    put(piece, auditRide, topBallC, S(G.sphereOf(topBallC, ballR, P, { steps: 24 }), { tone: "mid" }), {
      bias: 2.2,
      name: `${name}.davit-ball-top`,
      runtimeRide,
      shapes: [record(A.ball(topBallC, ballR, { name: `${name}.davit-ball-top`, owner: `${name}.davit-boss` }))],
    });
    const coverEdge = G.add3(pad.face, G.add3(G.mul3(outward, thick * 0.5), G.mul3(tan, flangeR)));
    const LF = G.frameAlong(coverEdge, tan);
    discPart(piece, auditRide, LF, -0.4, 2.0, 1.7, { tone: "mid" }, {
      bias: 2.2,
      name: `${name}.davit-lug`,
      owner: `${name}.neck`,
      runtimeRide,
    });
    const botBallC = G.add3(coverEdge, G.mul3(tan, 2.0 + Math.sqrt(ballR * ballR - 1.4 * 1.4)));
    put(piece, auditRide, botBallC, S(G.sphereOf(botBallC, ballR, P, { steps: 24 }), { tone: "mid" }), {
      bias: 2.2,
      name: `${name}.davit-ball-bot`,
      runtimeRide,
      shapes: [record(A.ball(botBallC, ballR, { name: `${name}.davit-ball-bot`, owner: `${name}.davit-lug` }))],
    });
    const rTube = 0.85;
    const rimOff = Math.sqrt(ballR * ballR - rTube * rTube);
    const armStart = G.add3(topBallC, G.mul3(tan, rimOff));
    const armElbow = [botBallC[0], botBallC[1], topBallC[2]];
    const armEnd = [botBallC[0], botBallC[1], botBallC[2] + rimOff];
    const davitRoute = G.fillet([armStart, armElbow, armEnd], 4.2, 12, { P, tube: rTube });
    R.route(`${name}.davit`, davitRoute, rTube, {
      owner: `${name}.davit`,
      piece,
      move: AUDIT_MOVES[auditRide],
      ride: auditRide,
      ends: [true, true],
    });
    tubePieces(davitRoute, rTube, P, { maxLength: 24, spacing: 1.0 }).forEach((part, idx) => {
      put(piece, auditRide, part.mid, tubeSvg(part, { tone: "mid" }), {
        bias: 2.3,
        name: `${name}.davit:${idx}`,
        route: `${name}.davit`,
        chunk: idx,
        runtimeRide,
        shapes: [A.tube(part.points, part.radii)],
      });
    });
  }
}

// =========================================================================
// 05. FLAT BOTTOM ANCHOR BASE PLATE (base)
// =========================================================================

discPart("skirt", "base", COL, Z_BASE_BOT, Z_BASE_TOP, R_BASE, { tone: "mid" }, {
  bevel: 0.7,
  name: "base.plate",
  extra:
    Ln(G.circleOf(COL, Z_BASE_TOP, R_SHELL + 1.2, P, 48), { tone: "faint" }) +
    Dots(G.dotsOf(COL, Z_BASE_TOP, R_BASE - 2.2, 20, P, { all: true }), { size: 0.45, tone: "hi" }),
});

// =========================================================================
// 04. LOWER LIQUID SUMP & GAS INLET SECTION (z = 4..108)
// =========================================================================

// Audited seamless 360° whole shells (fade in at 92%-98%)
const lowerShellA = discPart("lower", "lower", COL, Z_BASE_TOP, 54, R_SHELL, { tone: "hi" }, {
  name: "lower.shell-a",
  inner: G.arcOf(COL, 28, R_SHELL, P),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "lowerBack",
});
const lowerShellB = discPart("lower", "lower", COL, 54, Z_LOWER_TOP - 4.5, R_SHELL, { tone: "hi" }, {
  name: "lower.shell-b",
  inner: G.arcOf(COL, 78, R_SHELL, P),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "lowerBack",
});
flangeRing("lower", "lower", Z_LOWER_TOP - 4.5, Z_LOWER_TOP, R_FLANGE, {
  bolts: 24,
  openBore: R_LINER_IN,
  name: "lower.flange-top",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "lowerBack",
});
flangeRing("lining", "packing", Z_LOWER_TOP, Z_LIP1_TOP, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  tone: "hi",
  name: "lining.lip-lower",
  extraClass: "pt-tower-lining-lip pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "lowerLiningBack",
});

// Split cutaway halves for lower section (shell + continuous PTFE/PO lining + flared lip)
emitSplitSection({
  piece: "lower",
  backRide: "lowerBack",
  frontRide: "lowerFront",
  liningBackRide: "lowerLiningBack",
  liningFrontRide: "lowerLiningFront",
  zBot: Z_BASE_TOP,
  zTop: Z_LOWER_TOP,
  zLipTop: Z_LIP1_TOP,
  bottomFlange: false,
  seamZs: [28, 78],
  prefix: "lower",
});

// Lower-section front manway & nozzles (ride with lowerFront when split!)
sideNozzle("lower", "lower", "lowerFront", lowerShellA, cadDeg(90), 25, 7.6, 9.8, 5.2, {
  bolts: 12,
  blind: true,
  davit: true,
  name: "lower.m1",
});
sideNozzle("lower", "lower", "lowerFront", lowerShellA, cadDeg(180), 12, 2.2, 3.8, 4.4, {
  bolts: 4,
  openBore: 1.4,
  name: "lower.n5b",
});
sideNozzle("lower", "lower", "lowerFront", lowerShellA, cadDeg(225), 35, 2.2, 3.8, 4.4, {
  bolts: 4,
  openBore: 1.4,
  name: "lower.n7",
});
sideNozzle("lower", "lower", "lowerFront", lowerShellB, cadDeg(180), 68, 2.2, 3.8, 4.4, {
  bolts: 4,
  openBore: 1.4,
  name: "lower.n5a",
});
sideNozzle("lower", "lower", "lowerFront", lowerShellB, cadDeg(90), 88, 5.2, 7.6, 5.8, {
  bolts: 8,
  openBore: 4.1,
  name: "lower.n1",
});

// =========================================================================
// 03. PACKING BED + PERFORATED HOLD-DOWN / SUPPORT PLATES (centered inside mid lined cavity!)
// =========================================================================
{
  const Z_PACK_0 = Z_LIP1_TOP + 12; // 122.5 (seats cleanly inside mid section!)
  const Z_PACK_1 = Z_PACK_0 + 42; // 164.5
  const Z_PLATE_T = 2.6;

  function plateHoleDots(zTop) {
    const pts = [];
    const step = 3.5;
    for (let x = -20; x <= 20; x += step) {
      for (let y = -20; y <= 20; y += step) {
        if (x * x + y * y <= 20.8 * 20.8) {
          pts.push(at([x, y, zTop]));
        }
      }
    }
    return Dots(pts, { size: 0.65, tone: "hi" });
  }

  discPart("lining", "packing", COL, Z_PACK_0, Z_PACK_0 + Z_PLATE_T, R_INT, { tone: "hi" }, {
    bevel: 0.25,
    name: "packing.support-plate",
    role: "split",
    untracked: true,
    extraClass: "pt-tower-internal pt-tower-split-shell",
    fixedKey: (Z_PACK_0 + Z_PLATE_T * 0.5) * V[2] - 0.4,
  });

  const packPaths = G.disc(Z_PACK_0 + Z_PLATE_T, Z_PACK_1, R_INT - 0.5, COL, P, { bevel: 0.2, steps: 44 });
  const packSeams = [Z_PACK_0 + 13, Z_PACK_0 + 24, Z_PACK_0 + 35].map((s) => G.arcOf(COL, s, R_INT - 0.5, P)).join("");
  const packRibs = Faded(
    G.ribsOf(COL, Z_PACK_0 + Z_PLATE_T + 1, Z_PACK_1 - 1, R_INT - 0.5, 20, P, { fade: [0.12, 0.52], seams: true }),
    { tone: "lo" },
  );
  put(
    "lining",
    "packing",
    ex((Z_PACK_0 + Z_PACK_1) / 2),
    S(packPaths, { tone: "mid", inner: Ln(packSeams, { tone: "faint" }) }) + packRibs,
    {
      name: "packing.bed",
      role: "split",
      untracked: true,
      extraClass: "pt-tower-internal pt-tower-split-shell",
      fixedKey: ((Z_PACK_0 + Z_PACK_1) * 0.5) * V[2],
    },
  );

  discPart("lining", "packing", COL, Z_PACK_1, Z_PACK_1 + Z_PLATE_T, R_INT, { tone: "hi" }, {
    bevel: 0.3,
    extra:
      Ln(G.circleOf(COL, Z_PACK_1 + Z_PLATE_T, R_INT - 1.2, P, 40), { tone: "mid" }) +
      plateHoleDots(Z_PACK_1 + Z_PLATE_T),
    name: "packing.holddown-plate",
    role: "split",
    untracked: true,
    extraClass: "pt-tower-internal pt-tower-split-shell",
    fixedKey: (Z_PACK_1 + Z_PLATE_T * 0.5) * V[2] + 0.4,
  });
}

// =========================================================================
// 02 (Lower Half). MID FLANGED TOWER SECTION (z = 110.5..204)
// =========================================================================

flangeRing("sections", "midSection", Z_LIP1_TOP, Z_LIP1_TOP + 4.5, R_FLANGE, {
  bolts: 0,
  topBolts: false,
  bevel: 0.4,
  name: "mid.flange-bottom",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "midBack",
});
const midShellA = discPart("sections", "midSection", COL, Z_LIP1_TOP + 4.5, 158, R_SHELL, { tone: "hi" }, {
  name: "mid.shell-a",
  inner: G.arcOf(COL, 136, R_SHELL, P),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "midBack",
});
const midShellB = discPart("sections", "midSection", COL, 158, Z_MID_TOP - 4.5, R_SHELL, { tone: "hi" }, {
  name: "mid.shell-b",
  inner: G.arcOf(COL, 180, R_SHELL, P),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "midBack",
});
flangeRing("sections", "midSection", Z_MID_TOP - 4.5, Z_MID_TOP, R_FLANGE, {
  bolts: 24,
  openBore: R_LINER_IN,
  name: "mid.flange-top",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "midBack",
});
flangeRing("lining", "midSection", Z_MID_TOP, Z_LIP2_TOP, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  tone: "hi",
  name: "lining.lip-mid",
  extraClass: "pt-tower-lining-lip pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "midLiningBack",
});

emitSplitSection({
  piece: "sections",
  backRide: "midBack",
  frontRide: "midFront",
  liningBackRide: "midLiningBack",
  liningFrontRide: "midLiningFront",
  zBot: Z_LIP1_TOP,
  zTop: Z_MID_TOP,
  zLipTop: Z_LIP2_TOP,
  bottomFlange: true,
  seamZs: [136, 180],
  prefix: "mid",
});

sideNozzle("sections", "midSection", "midFront", midShellA, cadDeg(180), 128, 7.6, 9.8, 5.2, {
  bolts: 12,
  blind: true,
  name: "mid.m2",
});
sideNozzle("sections", "midSection", "midFront", midShellB, cadDeg(90), 173, 7.6, 9.8, 5.2, {
  bolts: 12,
  blind: true,
  name: "mid.m3",
});
sideNozzle("sections", "midSection", "midFront", midShellB, cadDeg(180), 190, 4.4, 6.6, 5.4, {
  bolts: 8,
  openBore: 3.4,
  name: "mid.n4a",
});

// =========================================================================
// 02 (Internal). TREE-SHAPED PP SPRAY PIPE DISTRIBUTOR (spray)
// =========================================================================
{
  const Z_SPRAY = Z_LIP2_TOP + 18; // 224.5 (clearly visible inside upper open lined cavity!)
  const headerAxis = dir(cadDeg(90));
  const branchAxis = dir(cadDeg(180));

  const sprayRing = G.arcPoints(COL, Z_SPRAY, R_INT - 0.8, 0, Math.PI * 2, 48);
  const sprayParts = [];
  for (const part of tubePieces(sprayRing, 1.0, P, { maxLength: 200, spacing: 2.2, closed: true })) {
    sprayParts.push(tubeSvg(part, { tone: "mid" }));
  }

  const branchOffsets = [-15.5, -9.3, -3.1, 3.1, 9.3, 15.5];
  for (const off of branchOffsets) {
    const halfSpan = Math.sqrt(Math.max(12, (R_INT - 2.0) ** 2 - off * off));
    const pStart = [
      headerAxis[0] * off - branchAxis[0] * halfSpan,
      headerAxis[1] * off - branchAxis[1] * halfSpan,
      Z_SPRAY,
    ];
    const pEnd = [
      headerAxis[0] * off + branchAxis[0] * halfSpan,
      headerAxis[1] * off + branchAxis[1] * halfSpan,
      Z_SPRAY,
    ];
    for (const part of tubePieces([pStart, pEnd], 1.1, P, { maxLength: 80, spacing: 2.4 })) {
      sprayParts.push(tubeSvg(part, { tone: "hi" }));
    }
    const nozzleCount = halfSpan > 18 ? 5 : 3;
    const nozzlePts = [];
    for (let j = 0; j < nozzleCount; j++) {
      const f = nozzleCount === 1 ? 0 : -0.78 + (1.56 * j) / (nozzleCount - 1);
      nozzlePts.push(
        at([
          headerAxis[0] * off + branchAxis[0] * halfSpan * f,
          headerAxis[1] * off + branchAxis[1] * halfSpan * f,
          Z_SPRAY - 1.8,
        ]),
      );
    }
    sprayParts.push(Dots(nozzlePts, { size: 0.72, tone: "hi" }));
  }

  const hStart = [-headerAxis[0] * (R_INT - 0.8), -headerAxis[1] * (R_INT - 0.8), Z_SPRAY + 1.4];
  const hEnd = [headerAxis[0] * (R_INT - 0.8), headerAxis[1] * (R_INT - 0.8), Z_SPRAY + 1.4];
  for (const part of tubePieces([hStart, hEnd], 2.1, P, { maxLength: 80, spacing: 2.0 })) {
    sprayParts.push(tubeSvg(part, { tone: "hi" }));
  }

  put("sections", "spray", ex(Z_SPRAY), sprayParts.join(""), {
    name: "spray.distributor",
    role: "split",
    untracked: true,
    extraClass: "pt-tower-internal pt-tower-split-shell",
    fixedKey: Z_SPRAY * V[2],
  });
}

// =========================================================================
// 02 (Upper Half). UPPER FLANGED TOWER SECTION (z = 206.5..326)
// =========================================================================

flangeRing("sections", "upperSection", Z_LIP2_TOP, Z_LIP2_TOP + 4.5, R_FLANGE, {
  bolts: 0,
  topBolts: false,
  bevel: 0.4,
  name: "upper.flange-bottom",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "upperBack",
});
const upperShellA = discPart("sections", "upperSection", COL, Z_LIP2_TOP + 4.5, 266, R_SHELL, { tone: "hi" }, {
  name: "upper.shell-a",
  inner: G.arcOf(COL, 236, R_SHELL, P),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "upperBack",
});
const upperShellB = discPart("sections", "upperSection", COL, 266, Z_UPPER_TOP - 4.5, R_SHELL, { tone: "hi" }, {
  name: "upper.shell-b",
  inner: G.arcOf(COL, 304, R_SHELL, P),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "upperBack",
});
flangeRing("sections", "upperSection", Z_UPPER_TOP - 4.5, Z_UPPER_TOP, R_FLANGE, {
  bolts: 24,
  openBore: R_LINER_IN,
  name: "upper.flange-top",
  extraClass: "pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "upperBack",
});
flangeRing("lining", "upperSection", Z_UPPER_TOP, Z_LIP3_TOP, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  tone: "hi",
  name: "lining.lip-upper",
  extraClass: "pt-tower-lining-lip pt-tower-whole-shell",
  role: "whole",
  runtimeRide: "upperLiningBack",
});

emitSplitSection({
  piece: "sections",
  backRide: "upperBack",
  frontRide: "upperFront",
  liningBackRide: "upperLiningBack",
  liningFrontRide: "upperLiningFront",
  zBot: Z_LIP2_TOP,
  zTop: Z_UPPER_TOP,
  zLipTop: Z_LIP3_TOP,
  bottomFlange: true,
  seamZs: [236, 304],
  prefix: "upper",
});

sideNozzle("sections", "upperSection", "upperFront", upperShellA, cadDeg(180), 228, 7.6, 9.8, 5.2, {
  bolts: 12,
  blind: true,
  name: "upper.m4",
});
sideNozzle("sections", "upperSection", "upperFront", upperShellB, cadDeg(90), 279, 7.6, 9.8, 5.2, {
  bolts: 12,
  blind: true,
  name: "upper.m5",
});
sideNozzle("sections", "upperSection", "upperFront", upperShellB, cadDeg(180), 296, 4.4, 6.6, 5.4, {
  bolts: 8,
  openBore: 3.4,
  name: "upper.n4b",
});

// =========================================================================
// 01 (Internal). PTFE WIRE-MESH DEMISTER + 4×4 SUPPORT GRID (demister)
// =========================================================================
{
  const Z_DEM_0 = Z_UPPER_TOP - 22; // 304 (seats inside upper open lined cavity!)
  const Z_DEM_1 = Z_DEM_0 + 8.5; // 312.5

  const gridLines = [];
  const barPos = [-12.5, -4.2, 4.2, 12.5];
  for (const offset of barPos) {
    const span = Math.sqrt(Math.max(4, (R_INT - 1.0) ** 2 - offset * offset));
    gridLines.push(k.lineOnTop([-span, offset], [span, offset], Z_DEM_1 + 0.05, P));
    gridLines.push(k.lineOnTop([offset, -span], [offset, span], Z_DEM_1 + 0.05, P));
  }

  discPart("top", "demister", COL, Z_DEM_0, Z_DEM_1, R_INT, { tone: "hi" }, {
    bevel: 0.3,
    inner: G.arcOf(COL, (Z_DEM_0 + Z_DEM_1) / 2, R_INT, P),
    extra:
      Ln(G.circleOf(COL, Z_DEM_1, R_INT - 1.0, P, 40), { tone: "mid" }) +
      Ln(gridLines.join(""), { tone: "mid" }),
    name: "demister.pad",
    role: "split",
    untracked: true,
    extraClass: "pt-tower-internal pt-tower-split-shell",
    fixedKey: ((Z_DEM_0 + Z_DEM_1) * 0.5) * V[2],
  });
}

// =========================================================================
// 01. FULL 360° TOP 2:1 ELLIPSOIDAL HEAD, 4 LIFTING LUGS & 90° GAS OUTLET ELBOW N2 (topHead)
// =========================================================================

flangeRing("top", "topHead", Z_LIP3_TOP, HEAD_Z0, R_FLANGE, {
  bolts: 0,
  topBolts: false,
  bevel: 0.4,
  bias: 5.8,
  name: "top.flange-bottom",
});

const topHeadRadius = (s) => {
  const u = Math.max(0, Math.min(HEAD_CUT_U, (s - HEAD_Z0) / HEAD_H));
  return R_SHELL * Math.sqrt(Math.max(0, 1 - u * u));
};
const topHeadSlope = (s) => {
  const u = Math.max(0, Math.min(HEAD_CUT_U, (s - HEAD_Z0) / HEAD_H));
  return (-R_SHELL * u) / (HEAD_H * Math.sqrt(Math.max(1e-5, 1 - u * u)));
};
const topHeadProfile = Array.from({ length: 21 }, (_, idx) => {
  const t = idx / 20;
  const u = HEAD_CUT_U * Math.sin(t * (Math.PI / 2));
  const s = HEAD_Z0 + HEAD_H * u;
  return [s, topHeadRadius(s), idx > 0 && idx < 20 ? 1 : 0];
});
const topHeadShape = record(A.solid(COL, topHeadProfile, { name: "top.head", radius: topHeadRadius }));
put(
  "top",
  "topHead",
  ex((HEAD_Z0 + Z_HEAD_CUT) / 2),
  S(G.solidOf(topHeadProfile, COL, P, { steps: 48, smooth: { slope: topHeadSlope, rows: 4 } }), {
    tone: "hi",
    inner: Ln(
      [0.36, 0.7].map((u) => G.arcOf(COL, HEAD_Z0 + HEAD_H * u, topHeadRadius(HEAD_Z0 + HEAD_H * u), P, { slope: topHeadSlope(HEAD_Z0 + HEAD_H * u) })).join(""),
      { tone: "faint" },
    ),
  }),
  { name: "top.head", bias: 6.0, shapes: [topHeadShape] },
);

for (const lugCad of [45, 135, 225, 315]) {
  const deg = cadDeg(lugCad);
  const rad = dir(deg);
  const tan = [-rad[1], rad[0], 0];
  const lugR = 32.5;
  const LF = G.frameOf([rad[0] * lugR, rad[1] * lugR, HEAD_Z0], tan, rad, [0, 0, 1]);
  const lugPoly = [
    [-3.0, 0],
    [3.0, 0],
    [2.3, 8],
    [0, 10],
    [-2.3, 8],
  ];
  const id = `top.lug.${lugCad}`;
  put(
    "top",
    "topHead",
    [rad[0] * lugR, rad[1] * lugR, HEAD_Z0 + 5],
    S(G.prismOf(LF, lugPoly, -1.0, 1.0, P), { tone: "mid" }) + Dots([at([rad[0] * lugR, rad[1] * lugR, HEAD_Z0 + 6.5])], { size: 0.5, tone: "hi" }),
    { name: id, bias: 6.2, shapes: [record(A.prism(LF, lugPoly, -1.0, 1.0, { name: id, owner: "top.flange-bottom" }))] },
  );
}

{
  const exitDir = dir(124);
  const neckTop = Z_HEAD_CUT + 5.5;
  discPart("top", "topHead", COL, Z_HEAD_CUT, neckTop - 2.2, R_OUTLET, { tone: "hi" }, {
    bias: 6.2,
    name: "top.n2-stub",
    owner: "top.head",
  });
  flangeRing("top", "topHead", neckTop - 2.2, neckTop, R_OUTLET * 1.55, {
    bolts: 8,
    boltR: R_OUTLET * 1.25,
    bevel: 0.3,
    bias: 6.2,
    name: "top.n2-base-flange",
  });

  const p0 = [0, 0, neckTop];
  const p1 = [0, 0, neckTop + 18];
  const p2 = [exitDir[0] * 21, exitDir[1] * 21, neckTop + 18];
  const elbowLine = G.fillet([p0, p1, p2], R_OUTLET * 2.2, 16, { P, tube: R_OUTLET });
  const total = G.pathLength(elbowLine);
  const endFlangeT = 2.4;
  const gaps = [[total - endFlangeT, total]];
  R.route("top.n2-elbow", elbowLine, R_OUTLET, {
    owner: "top.n2-elbow",
    gaps,
    ends: [true, false],
    free: [false, true],
    piece: "top",
    move: AUDIT_MOVES.topHead,
    ride: "topHead",
    rims: [R_OUTLET, R_OUTLET * 1.55],
  });
  tubePieces(elbowLine, R_OUTLET, P, { maxLength: 16, spacing: 1.4, gaps }).forEach((part, idx) => {
    put("top", "topHead", part.mid, tubeSvg(part, { tone: "hi" }), {
      bias: 6.2,
      name: `top.n2-elbow:${idx}`,
      route: "top.n2-elbow",
      chunk: idx,
      shapes: [A.tube(part.points, part.radii)],
    });
  });

  const EF = G.frameAlong(p2, exitDir);
  const bore = G.circleOf(EF, 0, R_OUTLET - 1.1, P, 24);
  discPart("top", "topHead", EF, -endFlangeT, 0, R_OUTLET * 1.55, { tone: "hi" }, {
    bevel: 0.3,
    bias: 6.2,
    name: "top.n2-exit-flange",
    owner: "top.n2-elbow",
    extra:
      `<path class="pt-tower-void" d="${bore}"/>` +
      Ln(bore, { tone: "mid" }) +
      Dots(G.dotsOf(EF, 0, R_OUTLET * 1.25, 8, P, { all: true }), { size: 0.38, tone: "mid" }),
  });
}

// =========================================================================
// SETTLE DEPTH KEYS & RUN GEOMETRY AUDIT
// =========================================================================

A.settle(R, P);

// Export using runtimeRide so front nozzles/manways travel cleanly with their split front shells!
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

const assembledCenter = at([0, 0, (Z_HEAD_CUT + 24) / 2]);
const recenterAssembledX = Number((W * 0.5 - assembledCenter[0]).toFixed(1));
const recenterAssembledY = Number((H * 0.5 - assembledCenter[1]).toFixed(1));

const rightEdge = (r, z) => {
  const rad = dir(CUT_RIGHT_DEG);
  const pt = at([rad[0] * r, rad[1] * r, z]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
};

const anchors = {
  top: { at: rightEdge(R_FLANGE, HEAD_Z0 + 6), ride: "topHead" },
  sections: { at: rightEdge(R_FLANGE, 248), ride: "upperBack" },
  lining: { at: rightEdge(R_LINER_OUT, 152), ride: "midLiningBack" },
  lower: { at: rightEdge(R_SHELL + 2, 58), ride: "lowerBack" },
  skirt: { at: rightEdge(R_BASE, 2), ride: "base" },
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

const tsOut = `// Auto-generated by app/products/towers/build-tower.mjs using Anatomy kit.
// Modeled from Zhaohui packed scrubbing column with diagonal longitudinal cutaway (schematic, non-proportional).
// Do not hand-edit; re-run: node app/products/towers/build-tower.mjs --audit

export interface TowerAssemblyItem {
  readonly index: number;
  readonly name: string;
  readonly piece: string;
  readonly ride: string;
  readonly role: "common" | "split" | "whole";
  readonly key: number;
  readonly extraClass: string;
  readonly svg: string;
}

export interface TowerAnchor {
  readonly at: readonly [number, number];
  readonly ride: string;
}

export interface TowerGeometryData {
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
  readonly anchors: Record<"top" | "sections" | "lining" | "lower" | "skirt", TowerAnchor>;
  readonly items: readonly TowerAssemblyItem[];
}

export const TOWER_GEOMETRY: TowerGeometryData = ${JSON.stringify(payload, null, 2)};
`;

writeFileSync(join(HERE, "tower-geometry.generated.ts"), tsOut, "utf8");
console.log(
  `wrote tower-geometry.generated.ts (${(tsOut.length / 1024).toFixed(1)} KB, ${exportedItems.length} items, recenter=(${recenterAssembledX}, ${recenterAssembledY}))`,
);

A.auditOrExit(R, P);
