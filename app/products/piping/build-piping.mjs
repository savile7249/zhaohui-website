import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../../.agents/skills/anatomy/kit/tube.mjs";
import * as A from "../../../.agents/skills/anatomy/kit/audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEG = Math.PI / 180;

// Isometric frame for a steel-lined flanged process piping & fittings assembly:
// - 01 Top flanged lined Tee fitting with side branch & bright white flared PTFE sealing faces
// - 02 & 03 Main vertical flanged straight pipe spool with diagonal cutaway exposing bright white PTFE liner wall
// - 04 Smooth 90° flanged lined Elbow + concentric Reducer exiting horizontally to front-right
const W = 640;
const H = 840;
const AZIMUTH = 42;
const ELEVATION = 25;

const CUT_LEFT_DEG = AZIMUTH + 90; // 132°
const CUT_RIGHT_DEG = AZIMUTH - 90; // -48°
const PULL_DEG = 104;
const PULL_DIR = [Math.cos(PULL_DEG * DEG), Math.sin(PULL_DEG * DEG), 0];

const PULL_LINING = 38;
const PULL_SHELL = 82;

// Pipe & fitting radii
const R_PIPE = 24.0;
const R_PIPE_IN = 20.6;
const R_LINER_OUT = 20.4;
const R_LINER_IN = 17.4;
const R_FLANGE = 34.0;
const R_LIP = 29.6;

// Reduced outlet pipe radii (after concentric reducer)
const R_RED_PIPE = 17.0;
const R_RED_FLANGE = 25.5;
const R_RED_LIP = 22.0;
const R_RED_BORE = 11.8;

// Elevations along main vertical riser & horizontal outlet axis
const Z_OUTLET_CL = 62.0; // Horizontal outlet centerline
const Z_ELBOW_TOP = 115.5; // Top face of 90° elbow mating flange
const Z_SPOOL_LIP_BOT = 118.0; // Bottom flared white PTFE lip between elbow & spool
const Z_SPOOL_TOP = 263.5; // Top face of straight spool flange
const Z_SPOOL_LIP_TOP = 266.0; // Top flared white PTFE lip between spool & tee
const Z_TEE_TOP = 340.5; // Top face of tee flange
const Z_TEE_LIP_TOP = 343.0; // Top flared white PTFE face on tee

const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
const EXIT_DEG = -22; // Front-right horizontal exit (screenX = +0.90)
const EXIT_DIR = dir(EXIT_DEG);

// Horizontal distances along EXIT_DIR from vertical centerline [0, 0, Z_OUTLET_CL]:
const S_ELBOW_END = 48.0; // Elbow flange face
const S_ELBOW_LIP = 50.5; // Flared PTFE lip between elbow & reducer
const S_RED_FLANGE_IN = 55.0; // Reducer inlet flange
const S_RED_CONE_END = 83.0; // Concentric cone tapers R_PIPE (24) -> R_RED_PIPE (17)
const S_OUTLET_FLANGE = 104.0; // Terminal outlet flange outer face

// Audited vertical explode offsets (90° elbow + reducer serves as stationary base at z = 0)
const AUDIT_MOVES = {
  elbow: [0, 0, 0],
  spoolBack: [0, 0, 36],
  tee: [0, 0, 84],
};

const STAGGER = ["tee", "spoolBack", "elbow"];
const SPRING = { stagger: 0.04, stiffness: 64, damping: 14.2, substeps: 4 };

const pullFar = [PULL_DIR[0] * PULL_SHELL, PULL_DIR[1] * PULL_SHELL];
const outFar = [EXIT_DIR[0] * (S_OUTLET_FLANGE + 10), EXIT_DIR[1] * (S_OUTLET_FLANGE + 10)];
const P = k.fitProjection(
  [
    [-46, -46, 24],
    [outFar[0] + 22, outFar[1] - 26, 24],
    [outFar[0] + 22, outFar[1] + 26, Z_OUTLET_CL + 30],
    [pullFar[0] - 42, pullFar[1] - 42, 36],
    [pullFar[0] + 42, pullFar[1] + 42, Z_SPOOL_TOP + 36],
    [pullFar[0] - 42, pullFar[1] + 42, Z_SPOOL_TOP + 36],
    [-48, -48, Z_TEE_LIP_TOP + 12 + AUDIT_MOVES.tee[2]],
    [48, 48, Z_TEE_LIP_TOP + 12 + AUDIT_MOVES.tee[2]],
    [-48, 48, Z_TEE_LIP_TOP + 12 + AUDIT_MOVES.tee[2]],
    [48, -48, Z_TEE_LIP_TOP + 12 + AUDIT_MOVES.tee[2]],
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
const OUT_FRAME = G.frameAlong([0, 0, Z_OUTLET_CL], EXIT_DIR);

const R = A.recorder(P, {
  order: STAGGER,
  spring: SPRING,
  ground: (shape) => shape.name.startsWith("elbow.flange-out"),
});
const { items, nameFor } = R;
const record = R.solid;

const extraItems = [];

function put(
  piece,
  auditRide,
  ref,
  svg,
  { bias = 0, shapes = [], name, route, chunk, extraClass = "", role = "common", runtimeRide, untracked = false, fixedKey = null } = {},
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
  { extra = "", inner = "", bias = 0, bevel = 0, steps, name, owner, extraClass = "", role = "common", runtimeRide } = {},
) {
  const facetSteps = steps ?? (r > 24 ? 44 : 28);
  const paths = G.disc(s0, s1, r, F, P, { bevel, steps: facetSteps });
  const id = nameFor(name ?? `${piece}.disc`);
  const shape = record(A.disc(F, s0, s1, r, { name: id, owner }));
  const mid = (s0 + s1) / 2;
  put(
    piece,
    auditRide,
    G.add3(F.o, G.mul3(F.a, mid)),
    S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra,
    { bias, name: id, shapes: [shape], extraClass, role, runtimeRide },
  );
  return shape;
}

function flangeRing(
  piece,
  auditRide,
  F,
  s0,
  s1,
  rOut,
  { bolts = 12, boltR, topBolts = true, bevel = 0.45, tone = "hi", openBore = 0, name, bias = 0, extraClass = "", role = "common" } = {},
) {
  const id = nameFor(name ?? `${piece}.flange`);
  const extraParts = [];
  if (G.dot3(F.a, V) > 0.1) {
    if (openBore > 0) {
      const voidPath = G.circleOf(F, s1, openBore, P, 40);
      extraParts.push(`<path class="pt-tower-void" d="${voidPath}"/>`);
      extraParts.push(Ln(voidPath, { tone: "mid" }));
    }
    if (topBolts && bolts > 0) {
      extraParts.push(Dots(G.dotsOf(F, s1, boltR ?? rOut - 3.6, bolts, P, { all: true }), { size: 0.45, tone: "mid" }));
    }
  }
  return discPart(piece, auditRide, F, s0, s1, rOut, { tone }, { bevel, extra: extraParts.join(""), bias, name: id, extraClass, role });
}

function saddlePad(piece, auditRide, host, point, outward, a, h, { tone = "hi", bias = 0.2, name, owner } = {}) {
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
    { bias, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] },
  );
  return { face: G.add3(point, G.mul3(axis, h)), axis, F };
}

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

function arcLine(r, aStartDeg, aEndDeg, z, steps = 26) {
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
  { tone = "hi", crease = "faint", extraClass = "", name, depthOffset = 0, seamZs = [], cutOutlineTone = "mid", steps = 28 } = {},
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
// 04. 90° FLANGED LINED ELBOW + CONCENTRIC REDUCER + WHITE FLARED OUTLET FACE (elbow)
// =========================================================================
{
  // Top mating steel flange on the 90° elbow
  flangeRing("elbow", "elbow", COL, Z_ELBOW_TOP - 4.5, Z_ELBOW_TOP, R_FLANGE, {
    bolts: 12,
    openBore: R_LINER_IN,
    name: "elbow.flange-top",
  });

  // Smooth 90° swept steel elbow (vertical [0, 0, 111] -> corner [0, 0, 62] -> horizontal S_ELBOW_END - 4.5)
  const p0 = [0, 0, Z_ELBOW_TOP - 4.5];
  const p1 = [0, 0, Z_OUTLET_CL];
  const p2 = [EXIT_DIR[0] * (S_ELBOW_END - 4.5), EXIT_DIR[1] * (S_ELBOW_END - 4.5), Z_OUTLET_CL];
  const elbowRoute = G.fillet([p0, p1, p2], 40, 18, { P, tube: R_PIPE });
  R.route("elbow.bend", elbowRoute, R_PIPE, {
    owner: "elbow.bend",
    ends: [true, true],
    piece: "elbow",
    move: AUDIT_MOVES.elbow,
    ride: "elbow",
  });
  tubePieces(elbowRoute, R_PIPE, P, { maxLength: 140, spacing: 2.0 }).forEach((part, idx) => {
    put("elbow", "elbow", part.mid, tubeSvg(part, { tone: "hi" }), {
      name: `elbow.bend:${idx}`,
      route: "elbow.bend",
      chunk: idx,
      shapes: [A.tube(part.points, part.radii)],
    });
  });

  // Elbow outlet flange + bright white PTFE sealing lip + reducer inlet mating flange
  flangeRing("elbow", "elbow", OUT_FRAME, S_ELBOW_END - 4.5, S_ELBOW_END, R_FLANGE, {
    bolts: 12,
    topBolts: false,
    name: "elbow.flange-out",
  });
  flangeRing("lining", "elbow", OUT_FRAME, S_ELBOW_END, S_ELBOW_LIP, R_LIP, {
    bolts: 0,
    bevel: 0.25,
    name: "elbow.lip-mid",
    extraClass: "pt-tower-lining-lip",
  });
  flangeRing("elbow", "elbow", OUT_FRAME, S_ELBOW_LIP, S_RED_FLANGE_IN, R_FLANGE, {
    bolts: 12,
    topBolts: false,
    name: "elbow.reducer-flange-in",
  });

  // Smooth concentric reducer cone (R_PIPE = 24 -> R_RED_PIPE = 17 over s = 55..83)
  const coneProfile = [
    [S_RED_FLANGE_IN, R_PIPE],
    [S_RED_CONE_END, R_RED_PIPE],
  ];
  const coneShape = record(A.solid(OUT_FRAME, coneProfile, { name: "elbow.reducer-cone" }));
  put(
    "elbow",
    "elbow",
    G.add3(OUT_FRAME.o, G.mul3(OUT_FRAME.a, (S_RED_FLANGE_IN + S_RED_CONE_END) / 2)),
    S(G.solidOf(coneProfile, OUT_FRAME, P, { steps: 40 }), {
      tone: "hi",
      inner: Ln(G.arcOf(OUT_FRAME, (S_RED_FLANGE_IN + S_RED_CONE_END) / 2, (R_PIPE + R_RED_PIPE) / 2, P), { tone: "faint" }),
    }),
    { name: "elbow.reducer-cone", shapes: [coneShape] },
  );

  // Straight horizontal reduced outlet neck (rests squarely on support.cradle at s = S_SUPPORT, bottom z = 45.0!)
  discPart("elbow", "elbow", OUT_FRAME, S_RED_CONE_END, S_OUTLET_FLANGE - 4.0, R_RED_PIPE, { tone: "hi" }, {
    name: "elbow.outlet-neck",
  });

  // Terminal 8-bolt outlet steel flange + prominent bright white flared PTFE sealing face + dark open bore!
  flangeRing("elbow", "elbow", OUT_FRAME, S_OUTLET_FLANGE - 4.0, S_OUTLET_FLANGE, R_RED_FLANGE, {
    bolts: 8,
    boltR: R_RED_FLANGE - 3.2,
    openBore: R_RED_BORE,
    name: "elbow.outlet-flange",
  });
  flangeRing("lining", "elbow", OUT_FRAME, S_OUTLET_FLANGE, S_OUTLET_FLANGE + 2.2, R_RED_LIP, {
    bolts: 0,
    bevel: 0.25,
    openBore: R_RED_BORE,
    name: "elbow.outlet-lip",
    extraClass: "pt-tower-lining-lip",
  });
}

// =========================================================================
// 02 & 03. MAIN VERTICAL FLANGED STRAIGHT PIPE SPOOL WITH DIAGONAL WHITE-LINER CUTAWAY
// - Full 360° bottom/top bolted steel flanges & full 360° bright white flared PTFE sealing faces
// - Straight pipe barrel (z = 122.5..259) splits diagonally to reveal thick white PTFE inner liner wall
// =========================================================================

// Bottom bright white flared PTFE sealing lip clamped between elbow & straight spool
flangeRing("lining", "spoolBack", COL, Z_ELBOW_TOP, Z_SPOOL_LIP_BOT, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  openBore: R_LINER_IN,
  name: "lining.lip-spool-bot",
  extraClass: "pt-tower-lining-lip",
  role: "common",
});

// Full 360° bottom & top bolted steel flanges of straight pipe spool
flangeRing("spool", "spoolBack", COL, Z_SPOOL_LIP_BOT, Z_SPOOL_LIP_BOT + 4.5, R_FLANGE, {
  bolts: 12,
  topBolts: false,
  name: "spool.flange-bot",
  role: "common",
});

// Audited seamless 360° whole straight steel pipe barrel (fades in at 88%..94%)
discPart("spool", "spoolBack", COL, Z_SPOOL_LIP_BOT + 4.5, Z_SPOOL_TOP - 4.5, R_PIPE, { tone: "hi" }, {
  name: "spool.whole",
  inner: [164, 214].map((zs) => G.arcOf(COL, zs, R_PIPE, P)).join(""),
  extraClass: "pt-tower-whole-shell",
  role: "whole",
});

flangeRing("spool", "spoolBack", COL, Z_SPOOL_TOP - 4.5, Z_SPOOL_TOP, R_FLANGE, {
  bolts: 12,
  openBore: R_LINER_IN,
  name: "spool.flange-top",
  role: "common",
});

// Top bright white flared PTFE sealing lip clamped between straight spool & top Tee
flangeRing("lining", "spoolBack", COL, Z_SPOOL_TOP, Z_SPOOL_LIP_TOP, R_LIP, {
  bolts: 0,
  bevel: 0.25,
  openBore: R_LINER_IN,
  name: "lining.lip-spool-top",
  extraClass: "pt-tower-lining-lip",
  role: "common",
});

// Diagonal Split-Shell Cutaway on straight pipe barrel (z = 122.5..259):
splitRingPart("spool", "spoolBack", "back", Z_SPOOL_LIP_BOT + 4.5, Z_SPOOL_TOP - 4.5, R_PIPE, R_PIPE_IN, {
  name: "spool.back",
  depthOffset: -6.0,
  seamZs: [164, 214],
});
splitRingPart("lining", "liningBack", "back", Z_SPOOL_LIP_BOT + 4.5, Z_SPOOL_TOP - 4.5, R_LINER_OUT, R_LINER_IN, {
  name: "lining.back",
  depthOffset: -2.8,
  seamZs: [164, 214],
  extraClass: "pt-tower-lining-sleeve",
  cutOutlineTone: "hi",
});
splitRingPart("lining", "liningFront", "front", Z_SPOOL_LIP_BOT + 4.5, Z_SPOOL_TOP - 4.5, R_LINER_OUT, R_LINER_IN, {
  name: "lining.front",
  depthOffset: 2.2,
  seamZs: [164, 214],
  extraClass: "pt-tower-lining-sleeve",
});
splitRingPart("spool", "spoolFront", "front", Z_SPOOL_LIP_BOT + 4.5, Z_SPOOL_TOP - 4.5, R_PIPE, R_PIPE_IN, {
  name: "spool.front",
  depthOffset: 5.0,
  seamZs: [164, 214],
});

// =========================================================================
// 01. TOP FLANGED LINED TEE FITTING WITH SIDE BRANCH & BRIGHT WHITE FLARED FACES (tee)
// =========================================================================
{
  flangeRing("tee", "tee", COL, Z_SPOOL_LIP_TOP, Z_SPOOL_LIP_TOP + 4.5, R_FLANGE, {
    bolts: 12,
    topBolts: false,
    bias: 5.8,
    name: "tee.flange-bot",
  });
  const teeBodyShape = discPart("tee", "tee", COL, Z_SPOOL_LIP_TOP + 4.5, Z_TEE_TOP - 4.5, R_PIPE, { tone: "hi" }, {
    bias: 6.0,
    name: "tee.body",
    inner: G.arcOf(COL, (Z_SPOOL_LIP_TOP + Z_TEE_TOP) / 2, R_PIPE, P),
  });
  flangeRing("tee", "tee", COL, Z_TEE_TOP - 4.5, Z_TEE_TOP, R_FLANGE, {
    bolts: 12,
    openBore: R_LINER_IN,
    bias: 6.0,
    name: "tee.flange-top",
  });
  flangeRing("lining", "tee", COL, Z_TEE_TOP, Z_TEE_LIP_TOP, R_LIP, {
    bolts: 0,
    bevel: 0.25,
    openBore: R_LINER_IN,
    bias: 6.2,
    name: "tee.lip-top",
    extraClass: "pt-tower-lining-lip",
  });

  // Side horizontal branch exiting cleanly to front-left (deg = +66°, facing viewer!)
  const branchDeg = 66;
  const branchDir = dir(branchDeg);
  const branchZ = (Z_SPOOL_LIP_TOP + Z_TEE_TOP) / 2; // 303.25
  const branchR = 17.5;
  const branchFlangeR = 26.5;
  const branchLipR = 22.8;
  const branchBore = 12.2;
  const branchPt = [branchDir[0] * R_PIPE, branchDir[1] * R_PIPE, branchZ];
  const pad = saddlePad("tee", "tee", teeBodyShape, branchPt, branchDir, branchR, 20.0, {
    tone: "hi",
    bias: 6.2,
    name: "tee.branch-neck",
  });
  const BF = G.frameAlong(pad.face, pad.axis);
  flangeRing("tee", "tee", BF, 0, 4.0, branchFlangeR, {
    bolts: 8,
    boltR: branchFlangeR - 3.2,
    openBore: branchBore,
    bias: 6.3,
    name: "tee.branch-flange",
  });
  flangeRing("lining", "tee", BF, 4.0, 6.0, branchLipR, {
    bolts: 0,
    bevel: 0.2,
    openBore: branchBore,
    bias: 6.4,
    name: "tee.branch-lip",
    extraClass: "pt-tower-lining-lip",
  });
}

// =========================================================================
// SETTLE DEPTH KEYS & RUN GEOMETRY AUDIT
// =========================================================================

A.settle(R, P);

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

const assembledCenter = at([EXIT_DIR[0] * 30, EXIT_DIR[1] * 30, (28 + Z_TEE_LIP_TOP + 6) / 2]);
const recenterAssembledX = Number((W * 0.5 - assembledCenter[0]).toFixed(1));
const recenterAssembledY = Number((H * 0.5 - assembledCenter[1]).toFixed(1));

const rightEdge = (r, z) => {
  const rad = dir(CUT_RIGHT_DEG);
  const pt = at([rad[0] * r, rad[1] * r, z]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
};

const outletFaceAnchor = (() => {
  const pt = at([EXIT_DIR[0] * (S_OUTLET_FLANGE + 4), EXIT_DIR[1] * (S_OUTLET_FLANGE + 4), Z_OUTLET_CL]);
  return [Number(pt[0].toFixed(1)), Number(pt[1].toFixed(1))];
})();

const anchors = {
  tee: { at: rightEdge(R_FLANGE, Z_TEE_TOP - 2), ride: "tee" },
  lining: { at: rightEdge(R_LINER_OUT, 198), ride: "liningBack" },
  spool: { at: rightEdge(R_FLANGE, Z_SPOOL_TOP - 2), ride: "spoolBack" },
  elbow: { at: outletFaceAnchor, ride: "elbow" },
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

const tsOut = `// Auto-generated by app/products/piping/build-piping.mjs using Anatomy kit.
// Steel-lined flanged piping & fittings assembly with diagonal cutaway (schematic, non-proportional).
// Do not hand-edit; re-run: node app/products/piping/build-piping.mjs --audit

export interface PipingAssemblyItem {
  readonly index: number;
  readonly name: string;
  readonly piece: string;
  readonly ride: string;
  readonly role: "common" | "split" | "whole";
  readonly key: number;
  readonly extraClass: string;
  readonly svg: string;
}

export interface PipingAnchor {
  readonly at: readonly [number, number];
  readonly ride: string;
}

export interface PipingGeometryData {
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
  readonly anchors: Record<"tee" | "lining" | "spool" | "elbow", PipingAnchor>;
  readonly items: readonly PipingAssemblyItem[];
}

export const PIPING_GEOMETRY: PipingGeometryData = ${JSON.stringify(payload, null, 2)};
`;

writeFileSync(join(HERE, "piping-geometry.generated.ts"), tsOut, "utf8");
console.log(
  `wrote piping-geometry.generated.ts (${(tsOut.length / 1024).toFixed(1)} KB, ${exportedItems.length} items, recenter=(${recenterAssembledX}, ${recenterAssembledY}))`,
);

A.auditOrExit(R, P);
