// projection-contract.mjs — deterministic, stdlib-only contract helpers for the optional
// presentation projection sibling. This module does not invoke Chromium and never mutates the
// canonical SVG/PNG. The CLI owns canonical verification through the full render.mjs entrypoint.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { constants as zlibConstants, deflateSync, inflateSync } from "node:zlib";

export const GLOBAL_MIN_PROJECTED_SCALE = 0.5;
export const CODEC = Object.freeze({
  id: "svginfo-png-rgba8-v1",
  accepted_color_types: [2, 6],
  bit_depth: 8,
  interlace: 0,
  color_space: "srgb-no-icc",
  scanline_filter: 4,
  zlib_level: 9,
  zlib_strategy: "Z_FIXED",
  resampling_kernel: "bilinear-rgba8-v1",
});

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const TOP_FIELDS = new Set([
  "schema_version", "id", "asset", "content_plane", "safe_area", "minimum_projected_scale",
  "layers", "canvas_adaptation", "blend_profile", "signature_slot", "required_attribution",
]);
const BLEND_PROFILES = new Set(["source-over-v1", "ink-on-surface-v1", "matte-display-v1"]);

function fail(message) { throw new Error(`projection contract: ${message}`); }
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function strict(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`unknown field ${label}.${key}`);
}
function finite(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    fail(`${label} must be ${integer ? "an integer" : "a number"} in [${min}, ${max}]`);
  return value;
}
function bool(value, label) { if (typeof value !== "boolean") fail(`${label} must be boolean`); }
function string(value, label, pattern = null) {
  if (typeof value !== "string" || !value || (pattern && !pattern.test(value))) fail(`${label} is invalid`);
  return value;
}
function safeRelative(value, label) {
  string(value, label);
  if (path.isAbsolute(value) || value.includes("\\") || value.split("/").includes("..") || /^[a-z][a-z0-9+.-]*:/i.test(value))
    fail(`${label} must be a safe relative path`);
}

export function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

export function planeCorners(plane) {
  if (plane.kind === "rect") {
    return [
      { x: plane.x, y: plane.y },
      { x: plane.x + plane.width - 1, y: plane.y },
      { x: plane.x + plane.width - 1, y: plane.y + plane.height - 1 },
      { x: plane.x, y: plane.y + plane.height - 1 },
    ];
  }
  return plane.points.map((p) => ({ x: p.x, y: p.y }));
}

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function convex(points) {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a=points[i], b=points[(i+1)%points.length], c=points[(i+2)%points.length];
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if (Math.abs(cross) < 1e-9) continue;
    const next=Math.sign(cross);
    if (sign && next!==sign) return false;
    sign=next;
  }
  return sign!==0;
}

function validatePlane(value) {
  object(value, "content_plane");
  if (value.kind === "rect") {
    strict(value, new Set(["kind", "x", "y", "width", "height"]), "content_plane");
    finite(value.x, "content_plane.x", { min: 0, integer: true });
    finite(value.y, "content_plane.y", { min: 0, integer: true });
    finite(value.width, "content_plane.width", { min: 2, integer: true });
    finite(value.height, "content_plane.height", { min: 2, integer: true });
  } else if (value.kind === "quad") {
    strict(value, new Set(["kind", "points"]), "content_plane");
    if (!Array.isArray(value.points) || value.points.length !== 4) fail("content_plane.points must contain tl,tr,br,bl");
    for (const [i, point] of value.points.entries()) {
      strict(point, new Set(["x", "y"]), `content_plane.points[${i}]`);
      finite(point.x, `content_plane.points[${i}].x`, { min: 0 });
      finite(point.y, `content_plane.points[${i}].y`, { min: 0 });
    }
    if (Math.abs(polygonArea(value.points)) < 1 || !convex(value.points)) fail("content_plane quad is degenerate or non-convex");
  } else fail("content_plane.kind must be rect or quad");
}

function validateLayers(value) {
  strict(value, new Set(["shadow", "grain", "ambient_gradient"]), "layers");
  strict(value.shadow, new Set(["enabled", "offset_x", "offset_y", "blur_radius", "opacity"]), "layers.shadow");
  bool(value.shadow.enabled, "layers.shadow.enabled");
  finite(value.shadow.offset_x, "layers.shadow.offset_x", { min: -64, max: 64 });
  finite(value.shadow.offset_y, "layers.shadow.offset_y", { min: -64, max: 64 });
  finite(value.shadow.blur_radius, "layers.shadow.blur_radius", { min: 0, max: 64 });
  finite(value.shadow.opacity, "layers.shadow.opacity", { min: 0, max: 0.35 });

  strict(value.grain, new Set(["enabled", "seed", "amplitude"]), "layers.grain");
  bool(value.grain.enabled, "layers.grain.enabled");
  finite(value.grain.seed, "layers.grain.seed", { min: 0, max: 0xffffffff, integer: true });
  finite(value.grain.amplitude, "layers.grain.amplitude", { min: 0, max: 6, integer: true });

  strict(value.ambient_gradient, new Set(["enabled", "from", "to", "opacity"]), "layers.ambient_gradient");
  bool(value.ambient_gradient.enabled, "layers.ambient_gradient.enabled");
  string(value.ambient_gradient.from, "layers.ambient_gradient.from", /^#[0-9a-f]{6}$/i);
  string(value.ambient_gradient.to, "layers.ambient_gradient.to", /^#[0-9a-f]{6}$/i);
  finite(value.ambient_gradient.opacity, "layers.ambient_gradient.opacity", { min: 0, max: 0.2 });
}

export function validateSurfaceManifest(input) {
  const value = structuredClone(input);
  strict(value, TOP_FIELDS, "surface");
  if (value.schema_version !== 1) fail("schema_version must be 1");
  string(value.id, "id", /^[a-z0-9]+(?:-[a-z0-9]+)*$/);

  strict(value.asset, new Set([
    "path", "sha256", "width", "height", "color_space", "license", "redistribution", "provenance",
  ]), "asset");
  safeRelative(value.asset.path, "asset.path");
  string(value.asset.sha256, "asset.sha256", /^[0-9a-f]{64}$/);
  finite(value.asset.width, "asset.width", { min: 2, integer: true });
  finite(value.asset.height, "asset.height", { min: 2, integer: true });
  if (value.asset.color_space !== "srgb") fail("asset.color_space must be srgb");
  string(value.asset.license, "asset.license");
  if (!["allowed", "prohibited", "review-required"].includes(value.asset.redistribution)) fail("asset.redistribution is invalid");
  strict(value.asset.provenance, new Set([
    "kind", "creator", "created_on", "tool", "tool_identifier", "terms_basis", "human_disposition",
    "identifiable_work_mark_character_absent", "source_sha256", "normalization",
  ]), "asset.provenance");
  if (!["authored", "generated", "photographed", "illustrated"].includes(value.asset.provenance.kind))
    fail("asset.provenance.kind is invalid");
  string(value.asset.provenance.creator, "asset.provenance.creator");
  string(value.asset.provenance.created_on, "asset.provenance.created_on", /^\d{4}-\d{2}-\d{2}$/);
  if (value.asset.provenance.kind === "generated") {
    for (const field of ["tool", "tool_identifier", "terms_basis", "human_disposition"])
      string(value.asset.provenance[field], `asset.provenance.${field}`);
    string(value.asset.provenance.source_sha256, "asset.provenance.source_sha256", /^[0-9a-f]{64}$/);
    if (value.asset.provenance.normalization !== null) {
      strict(value.asset.provenance.normalization, new Set([
        "tool", "tool_version", "profile", "operations", "performed_on",
      ]), "asset.provenance.normalization");
      for (const field of ["tool", "tool_version", "profile", "operations"])
        string(value.asset.provenance.normalization[field], `asset.provenance.normalization.${field}`);
      string(value.asset.provenance.normalization.performed_on, "asset.provenance.normalization.performed_on", /^\d{4}-\d{2}-\d{2}$/);
    }
    if (value.asset.provenance.identifiable_work_mark_character_absent !== true)
      fail("generated provenance requires identifiable_work_mark_character_absent=true");
  }

  validatePlane(value.content_plane);
  strict(value.safe_area, new Set(["x", "y", "width", "height"]), "safe_area");
  for (const key of ["x", "y"]) finite(value.safe_area[key], `safe_area.${key}`, { min: 0, integer: true });
  for (const key of ["width", "height"]) finite(value.safe_area[key], `safe_area.${key}`, { min: 2, integer: true });
  finite(value.minimum_projected_scale, "minimum_projected_scale", { min: GLOBAL_MIN_PROJECTED_SCALE, max: 1 });
  validateLayers(value.layers);
  if (value.canvas_adaptation !== null && value.canvas_adaptation !== undefined) {
    if (value.canvas_adaptation.mode === "boundary-connected-exact-rgba") {
      strict(value.canvas_adaptation, new Set(["mode", "color", "alpha", "connectivity"]), "canvas_adaptation");
      string(value.canvas_adaptation.color, "canvas_adaptation.color", /^#[0-9a-f]{6}$/i);
    } else if (value.canvas_adaptation.mode === "boundary-connected-dominant-border-exact-rgba") {
      strict(value.canvas_adaptation, new Set(["mode", "alpha", "connectivity", "minimum_border_share"]), "canvas_adaptation");
      finite(value.canvas_adaptation.minimum_border_share, "canvas_adaptation.minimum_border_share", { min: 0.5, max: 1 });
    } else {
      fail("canvas_adaptation.mode is not registered");
    }
    finite(value.canvas_adaptation.alpha, "canvas_adaptation.alpha", { min: 0, max: 255, integer: true });
    if (value.canvas_adaptation.connectivity !== 4) fail("canvas_adaptation.connectivity must be 4 in v1");
  }
  if (!BLEND_PROFILES.has(value.blend_profile)) fail("blend_profile is not a registered v1 profile");

  strict(value.signature_slot, new Set(["x", "y", "width", "height", "default", "color"]), "signature_slot");
  for (const key of ["x", "y"]) finite(value.signature_slot[key], `signature_slot.${key}`, { min: 0, integer: true });
  for (const key of ["width", "height"]) finite(value.signature_slot[key], `signature_slot.${key}`, { min: 1, integer: true });
  if (value.signature_slot.default !== null) fail("signature_slot.default must be null; signature is user-provided only");
  string(value.signature_slot.color, "signature_slot.color", /^#[0-9a-f]{6}$/i);
  if (value.signature_slot.x + value.signature_slot.width > value.asset.width || value.signature_slot.y + value.signature_slot.height > value.asset.height)
    fail("signature_slot must stay inside asset dimensions");
  if (value.required_attribution !== null && typeof value.required_attribution !== "string")
    fail("required_attribution must be null or string");

  const right = value.safe_area.x + value.safe_area.width - 1;
  const bottom = value.safe_area.y + value.safe_area.height - 1;
  for (const point of planeCorners(value.content_plane)) {
    if (point.x < value.safe_area.x || point.x > right || point.y < value.safe_area.y || point.y > bottom)
      fail("content plane must stay inside safe area");
  }
  for (const point of planeCorners(value.content_plane)) {
    if (point.x >= value.asset.width || point.y >= value.asset.height) fail("content plane must stay inside asset dimensions");
  }
  const corners=planeCorners(value.content_plane), planeBox={
    x1:Math.min(...corners.map(p=>p.x)),y1:Math.min(...corners.map(p=>p.y)),
    x2:Math.max(...corners.map(p=>p.x)),y2:Math.max(...corners.map(p=>p.y)),
  };
  const slot={x1:value.signature_slot.x,y1:value.signature_slot.y,x2:value.signature_slot.x+value.signature_slot.width-1,y2:value.signature_slot.y+value.signature_slot.height-1};
  if(!(slot.x2<planeBox.x1||slot.x1>planeBox.x2||slot.y2<planeBox.y1||slot.y1>planeBox.y2))
    fail("signature_slot must not intersect the content plane bounding box");
  return value;
}

export function classifyCanonicalPair({ renderExit, suppliedValid, bytesEqual }) {
  if (renderExit !== 0) return { classification: "canonical-validation-failed", cause: `render-exit-${renderExit}` };
  if (!suppliedValid) return { classification: "canonical-pair-invalid", cause: "malformed-or-dimension-mismatch" };
  if (!bytesEqual) return { classification: "canonical-bytes-mismatch", cause: "unavailable" };
  return { classification: "pass", cause: null };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function pngChunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) fail("PNG signature is invalid");
  let offset = 8, ihdr = null, ended = false;
  const idat = [];
  const allowed = new Set(["IHDR", "IDAT", "IEND", "sRGB", "pHYs"]);
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (offset + 12 + length > buffer.length) fail("PNG chunk is truncated");
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expected = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([Buffer.from(type, "ascii"), data])) !== expected) fail(`PNG ${type} CRC mismatch`);
    if (!allowed.has(type)) fail(`PNG chunk ${type} is unsupported (sRGB/no-ICC subset only)`);
    if (type === "IHDR") {
      if (ihdr || length !== 13) fail("PNG IHDR is invalid");
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9],
        compression: data[10], filter: data[11], interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") { ended = true; offset += 12 + length; break; }
    offset += 12 + length;
  }
  if (!ihdr || !ended || offset !== buffer.length || idat.length === 0) fail("PNG must have one complete IHDR/IDAT/IEND chain at EOF");
  if (ihdr.bitDepth !== 8 || !CODEC.accepted_color_types.includes(ihdr.colorType) || ihdr.compression !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0)
    fail("PNG must be non-interlaced 8-bit RGB or RGBA in the supported subset");
  const bpp = ihdr.colorType === 6 ? 4 : 3;
  const stride = ihdr.width * bpp;
  const packed = inflateSync(Buffer.concat(idat));
  if (packed.length !== (stride + 1) * ihdr.height) fail("PNG inflated byte count is invalid");
  const raw = Buffer.alloc(stride * ihdr.height);
  for (let y = 0; y < ihdr.height; y++) {
    const filter = packed[y * (stride + 1)];
    if (filter > 4) fail(`PNG scanline filter ${filter} is unsupported`);
    const src = y * (stride + 1) + 1, row = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? raw[row + x - bpp] : 0;
      const up = y > 0 ? raw[row - stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? raw[row - stride + x - bpp] : 0;
      const f = packed[src + x];
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upLeft);
      raw[row + x] = (f + predictor) & 0xff;
    }
  }
  if (bpp === 4) return { width: ihdr.width, height: ihdr.height, data: raw };
  const rgba = Buffer.alloc(ihdr.width * ihdr.height * 4);
  for (let s = 0, d = 0; s < raw.length; s += 3, d += 4) {
    rgba[d] = raw[s]; rgba[d + 1] = raw[s + 1]; rgba[d + 2] = raw[s + 2]; rgba[d + 3] = 255;
  }
  return { width: ihdr.width, height: ihdr.height, data: rgba };
}

export function encodePng({ width, height, data }) {
  finite(width, "PNG width", { min: 1, integer: true });
  finite(height, "PNG height", { min: 1, integer: true });
  if (!Buffer.isBuffer(data) || data.length !== width * height * 4) fail("PNG RGBA byte count is invalid");
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const out = y * (stride + 1), row = y * stride;
    filtered[out] = CODEC.scanline_filter;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? data[row + x - 4] : 0;
      const up = y > 0 ? data[row - stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? data[row - stride + x - 4] : 0;
      filtered[out + 1 + x] = (data[row + x] - paeth(left, up, upLeft) + 256) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const compressed = deflateSync(filtered, { level: CODEC.zlib_level, strategy: zlibConstants.Z_FIXED });
  return Buffer.concat([PNG_SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND")]);
}

function invert3(m) {
  const [a,b,c,d,e,f,g,h,i] = m;
  const A=e*i-f*h, B=-(d*i-f*g), C=d*h-e*g;
  const D=-(b*i-c*h), E=a*i-c*g, F=-(a*h-b*g);
  const G=b*f-c*e, H=-(a*f-c*d), I=a*e-b*d;
  const det=a*A+b*B+c*C;
  if (Math.abs(det) < 1e-12) fail("content plane transform is singular");
  return [A/det,D/det,G/det,B/det,E/det,H/det,C/det,F/det,I/det];
}
function squareToQuad(points) {
  const [p0,p1,p2,p3] = points;
  const dx1=p1.x-p2.x, dx2=p3.x-p2.x, dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y, dy2=p3.y-p2.y, dy3=p0.y-p1.y+p2.y-p3.y;
  let g=0,h=0;
  if (Math.abs(dx3) > 1e-12 || Math.abs(dy3) > 1e-12) {
    const den=dx1*dy2-dx2*dy1;
    if (Math.abs(den) < 1e-12) fail("content plane quad is singular");
    g=(dx3*dy2-dx2*dy3)/den;
    h=(dx1*dy3-dx3*dy1)/den;
  }
  return [p1.x-p0.x+g*p1.x,p3.x-p0.x+h*p3.x,p0.x,
          p1.y-p0.y+g*p1.y,p3.y-p0.y+h*p3.y,p0.y,g,h,1];
}
function uvMapper(plane) {
  const points = planeCorners(plane);
  const inv = invert3(squareToQuad(points));
  return (x,y) => {
    const den=inv[6]*x+inv[7]*y+inv[8];
    return { u:(inv[0]*x+inv[1]*y+inv[2])/den, v:(inv[3]*x+inv[4]*y+inv[5])/den };
  };
}
function bilinear(source, u, v) {
  const sx=Math.max(0,Math.min(source.width-1,u*(source.width-1)));
  const sy=Math.max(0,Math.min(source.height-1,v*(source.height-1)));
  const x0=Math.floor(sx), y0=Math.floor(sy), x1=Math.min(source.width-1,x0+1), y1=Math.min(source.height-1,y0+1);
  const tx=sx-x0, ty=sy-y0;
  const samples=[[x0,y0,(1-tx)*(1-ty)],[x1,y0,tx*(1-ty)],[x0,y1,(1-tx)*ty],[x1,y1,tx*ty]];
  let alpha=0;const premul=[0,0,0];
  for(const [x,y,weight] of samples){
    const d=(y*source.width+x)*4,a=source.data[d+3]/255;
    alpha+=weight*a;for(let c=0;c<3;c++)premul[c]+=weight*source.data[d+c]*a;
  }
  return [
    alpha>1e-12?Math.round(premul[0]/alpha):0,
    alpha>1e-12?Math.round(premul[1]/alpha):0,
    alpha>1e-12?Math.round(premul[2]/alpha):0,
    Math.round(alpha*255),
  ];
}

export function maskBoundaryConnectedCanvas(source, adaptation) {
  if(adaptation===null||adaptation===undefined)return {width:source.width,height:source.height,data:Buffer.from(source.data)};
  const out={width:source.width,height:source.height,data:Buffer.from(source.data)};
  let target,borderShare=1;
  if(adaptation.mode==="boundary-connected-exact-rgba")target=[...hexRgb(adaptation.color),adaptation.alpha];
  else{
    const border=[];
    for(let x=0;x<source.width;x++){border.push(x);border.push((source.height-1)*source.width+x);}
    for(let y=1;y+1<source.height;y++){border.push(y*source.width);border.push(y*source.width+source.width-1);}
    const counts=new Map();
    for(const index of border){
      const d=index*4;if(source.data[d+3]!==adaptation.alpha)continue;
      const key=source.data.subarray(d,d+4).toString("hex");counts.set(key,(counts.get(key)??0)+1);
    }
    const selected=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
    if(!selected)fail("canvas adaptation found no border pixel with the declared alpha");
    borderShare=selected[1]/border.length;
    if(borderShare+1e-12<adaptation.minimum_border_share)
      fail(`dominant border share ${borderShare.toFixed(6)} is below floor ${adaptation.minimum_border_share}`);
    target=[...Buffer.from(selected[0],"hex")];
  }
  const count=source.width*source.height,seen=new Uint8Array(count),queue=new Int32Array(count);
  let head=0,tail=0;
  const matches=(index)=>{const d=index*4;return target.every((value,c)=>source.data[d+c]===value);};
  const add=(index)=>{if(!seen[index]&&matches(index)){seen[index]=1;queue[tail++]=index;}};
  for(let x=0;x<source.width;x++){add(x);add((source.height-1)*source.width+x);}
  for(let y=0;y<source.height;y++){add(y*source.width);add(y*source.width+source.width-1);}
  while(head<tail){
    const index=queue[head++],x=index%source.width,y=(index-x)/source.width;
    if(x>0)add(index-1);if(x+1<source.width)add(index+1);
    if(y>0)add(index-source.width);if(y+1<source.height)add(index+source.width);
  }
  for(let i=0;i<count;i++)if(seen[i])out.data[i*4+3]=0;
  return {...out,masked_pixels:tail,canvas_adaptation:{mode:adaptation.mode,target_rgba:target,border_share:borderShare,masked_pixels:tail}};
}

function reduceChroma(pixel,numerator) {
  const y=Math.round((54*pixel[0]+183*pixel[1]+19*pixel[2])/256);
  return [0,1,2].map((c)=>Math.max(0,Math.min(255,Math.round(y+(pixel[c]-y)*numerator/256))));
}

export function projectImage({ background, source, plane, blendProfile="source-over-v1" }) {
  if (!background || background.data.length !== background.width*background.height*4) fail("background RGBA is invalid");
  if (!source || source.data.length !== source.width*source.height*4) fail("source RGBA is invalid");
  const out={ width:background.width, height:background.height, data:Buffer.from(background.data) };
  const map=uvMapper(plane), corners=planeCorners(plane);
  const minX=Math.max(0,Math.floor(Math.min(...corners.map((p)=>p.x))));
  const maxX=Math.min(out.width-1,Math.ceil(Math.max(...corners.map((p)=>p.x))));
  const minY=Math.max(0,Math.floor(Math.min(...corners.map((p)=>p.y))));
  const maxY=Math.min(out.height-1,Math.ceil(Math.max(...corners.map((p)=>p.y))));
  for (let y=minY;y<=maxY;y++) for (let x=minX;x<=maxX;x++) {
    const {u,v}=map(x,y);
    if (u < -1e-9 || u > 1+1e-9 || v < -1e-9 || v > 1+1e-9) continue;
    const pixel=bilinear(source,u,v),d=(y*out.width+x)*4;
    const sa=pixel[3]/255,da=out.data[d+3]/255,oa=sa+da*(1-sa);
    const chroma=blendProfile==="source-over-v1"?[pixel[0],pixel[1],pixel[2]]:reduceChroma(pixel,224);
    for(let c=0;c<3;c++){
      const sourceColor=blendProfile==="ink-on-surface-v1"?Math.round(out.data[d+c]*chroma[c]/255):chroma[c];
      out.data[d+c]=oa>1e-12?Math.round((sourceColor*sa+out.data[d+c]*da*(1-sa))/oa):0;
    }
    out.data[d+3]=Math.round(oa*255);
  }
  return out;
}

export function projectedScale({ source, plane }) {
  const [tl,tr,br,bl]=planeCorners(plane);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  return Math.min(
    distance(tl,tr)/Math.max(1,source.width-1),
    distance(bl,br)/Math.max(1,source.width-1),
    distance(tl,bl)/Math.max(1,source.height-1),
    distance(tr,br)/Math.max(1,source.height-1),
  );
}

function xorshift32(state) {
  state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
  return state >>> 0;
}
function hexRgb(value) { return [1,3,5].map((i)=>parseInt(value.slice(i,i+2),16)); }
export function applyBackgroundLayers(background, layers) {
  const out={width:background.width,height:background.height,data:Buffer.from(background.data)};
  if (layers.ambient_gradient.enabled && layers.ambient_gradient.opacity > 0) {
    const from=hexRgb(layers.ambient_gradient.from), to=hexRgb(layers.ambient_gradient.to), alpha=layers.ambient_gradient.opacity;
    for (let y=0;y<out.height;y++) {
      const t=out.height===1?0:y/(out.height-1);
      for (let x=0;x<out.width;x++) {
        const d=(y*out.width+x)*4;
        for (let c=0;c<3;c++) {
          const overlay=from[c]*(1-t)+to[c]*t;
          out.data[d+c]=Math.round(out.data[d+c]*(1-alpha)+overlay*alpha);
        }
      }
    }
  }
  if (layers.grain.enabled && layers.grain.amplitude > 0) {
    let state=layers.grain.seed>>>0;
    for (let d=0;d<out.data.length;d+=4) {
      state=xorshift32(state || 0x6d2b79f5);
      const delta=(state%(layers.grain.amplitude*2+1))-layers.grain.amplitude;
      for (let c=0;c<3;c++) out.data[d+c]=Math.max(0,Math.min(255,out.data[d+c]+delta));
    }
  }
  return out;
}

function blurMask(mask,width,height,radius) {
  if (radius<=0) return mask;
  const tmp=new Float64Array(mask.length), out=new Float64Array(mask.length), span=radius*2+1;
  for (let y=0;y<height;y++) {
    let sum=0;
    for (let x=-radius;x<=radius;x++) if (x>=0&&x<width) sum+=mask[y*width+x];
    for (let x=0;x<width;x++) {
      tmp[y*width+x]=sum/span;
      const drop=x-radius, add=x+radius+1;
      if (drop>=0) sum-=mask[y*width+drop];
      if (add<width) sum+=mask[y*width+add];
    }
  }
  for (let x=0;x<width;x++) {
    let sum=0;
    for (let y=-radius;y<=radius;y++) if (y>=0&&y<height) sum+=tmp[y*width+x];
    for (let y=0;y<height;y++) {
      out[y*width+x]=sum/span;
      const drop=y-radius, add=y+radius+1;
      if (drop>=0) sum-=tmp[drop*width+x];
      if (add<height) sum+=tmp[add*width+x];
    }
  }
  return out;
}
export function applyShadow(background,plane,shadow) {
  if (!shadow.enabled||shadow.opacity===0) return {width:background.width,height:background.height,data:Buffer.from(background.data)};
  const mask=new Float64Array(background.width*background.height);
  const corners=planeCorners(plane), minX=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))+shadow.offset_x-shadow.blur_radius));
  const maxX=Math.min(background.width-1,Math.ceil(Math.max(...corners.map(p=>p.x))+shadow.offset_x+shadow.blur_radius));
  const minY=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))+shadow.offset_y-shadow.blur_radius));
  const maxY=Math.min(background.height-1,Math.ceil(Math.max(...corners.map(p=>p.y))+shadow.offset_y+shadow.blur_radius));
  const map=uvMapper(plane);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const {u,v}=map(x-shadow.offset_x,y-shadow.offset_y);
    if(u>=-1e-9&&u<=1+1e-9&&v>=-1e-9&&v<=1+1e-9)mask[y*background.width+x]=1;
  }
  const blurred=blurMask(mask,background.width,background.height,Math.round(shadow.blur_radius));
  const out={width:background.width,height:background.height,data:Buffer.from(background.data)};
  for(let i=0;i<blurred.length;i++){
    const alpha=blurred[i]*shadow.opacity,d=i*4;
    for(let c=0;c<3;c++)out.data[d+c]=Math.round(out.data[d+c]*(1-alpha));
  }
  return out;
}

export function composeProjection({background,source,plane,layers,canvasAdaptation=null,blendProfile="source-over-v1"}) {
  const treated=applyBackgroundLayers(background,layers);
  const shadowed=applyShadow(treated,plane,layers.shadow);
  const adapted=maskBoundaryConnectedCanvas(source,canvasAdaptation);
  const projected=projectImage({background:shadowed,source:adapted,plane,blendProfile});
  return {...projected,canvas_adaptation:adapted.canvas_adaptation??null};
}

const SIGNATURE_GLYPHS = Object.freeze({
  A:["010","101","111","101","101"],B:["110","101","110","101","110"],
  C:["011","100","100","100","011"],D:["110","101","101","101","110"],
  E:["111","100","110","100","111"],F:["111","100","110","100","100"],
  G:["011","100","101","101","011"],H:["101","101","111","101","101"],
  I:["111","010","010","010","111"],J:["001","001","001","101","010"],
  K:["101","101","110","101","101"],L:["100","100","100","100","111"],
  M:["101","111","111","101","101"],N:["101","111","111","111","101"],
  O:["010","101","101","101","010"],P:["110","101","110","100","100"],
  Q:["010","101","101","111","011"],R:["110","101","110","101","101"],
  S:["011","100","010","001","110"],T:["111","010","010","010","010"],
  U:["101","101","101","101","111"],V:["101","101","101","101","010"],
  W:["101","101","111","111","101"],X:["101","101","010","101","101"],
  Y:["101","101","010","010","010"],Z:["111","001","010","100","111"],
  a:["000","011","101","101","011"],b:["100","110","101","101","110"],
  c:["000","011","100","100","011"],d:["001","011","101","101","011"],
  e:["000","010","101","110","011"],f:["011","010","111","010","010"],
  g:["000","011","101","011","001"],h:["100","110","101","101","101"],
  i:["010","000","110","010","111"],j:["001","000","001","101","010"],
  k:["100","101","110","101","101"],l:["110","010","010","010","111"],
  m:["000","111","111","101","101"],n:["000","110","101","101","101"],
  o:["000","010","101","101","010"],p:["000","110","101","110","100"],
  q:["000","011","101","011","001"],r:["000","110","101","100","100"],
  s:["000","011","110","001","110"],t:["010","111","010","010","011"],
  u:["000","101","101","101","011"],v:["000","101","101","101","010"],
  w:["000","101","101","111","111"],x:["000","101","010","010","101"],
  y:["000","101","101","011","001"],z:["000","111","001","010","111"],
  0:["111","101","101","101","111"],1:["010","110","010","010","111"],
  2:["110","001","010","100","111"],3:["110","001","010","001","110"],
  4:["101","101","111","001","001"],5:["111","100","110","001","110"],
  6:["011","100","111","101","111"],7:["111","001","010","010","010"],
  8:["111","101","111","101","111"],9:["111","101","111","001","110"],
  ".":["000","000","000","000","010"],
  "/":["001","001","010","100","100"],
  ":":["000","010","000","010","000"],
  "-":["000","000","111","000","000"],
  "_":["000","000","000","000","111"],
  "@":["010","101","111","100","011"],
  " ":["000","000","000","000","000"],
});

export function renderSignature(image, slot, text) {
  if (!image || image.data.length !== image.width*image.height*4) fail("signature target RGBA is invalid");
  if (typeof text !== "string" || text.length < 1 || text.length > 64 || !/^[A-Za-z0-9 .\/:@_-]+$/.test(text))
    fail("signature must be 1..64 characters from the v1 ASCII set");
  const glyphs=[...text].map((char)=>SIGNATURE_GLYPHS[char]);
  if(glyphs.some((glyph)=>!glyph))fail("signature contains an unsupported glyph");
  const units=glyphs.length*4-1;
  const scale=Math.min(4,Math.floor(slot.height/5),Math.floor(slot.width/units));
  if(scale<1)fail("signature does not fit its declared slot");
  const out={width:image.width,height:image.height,data:Buffer.from(image.data)};
  const rgb=hexRgb(slot.color), renderedWidth=units*scale;
  const startX=slot.x+slot.width-renderedWidth;
  const startY=slot.y+Math.floor((slot.height-5*scale)/2);
  for(let index=0;index<glyphs.length;index++)for(let row=0;row<5;row++)for(let col=0;col<3;col++){
    if(glyphs[index][row][col]!=="1")continue;
    const x0=startX+(index*4+col)*scale,y0=startY+row*scale;
    for(let y=y0;y<y0+scale;y++)for(let x=x0;x<x0+scale;x++){
      const d=(y*out.width+x)*4;out.data[d]=rgb[0];out.data[d+1]=rgb[1];out.data[d+2]=rgb[2];out.data[d+3]=255;
    }
  }
  return out;
}

function fsyncWrite(file, bytes) {
  const fd=fs.openSync(file,"wx",0o600);
  try { fs.writeFileSync(fd,bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function writeProjectionTransaction({ outputPath, receiptPath, outputBytes, receipt }) {
  const out=path.resolve(outputPath), rec=path.resolve(receiptPath);
  fs.mkdirSync(path.dirname(out),{recursive:true}); fs.mkdirSync(path.dirname(rec),{recursive:true});
  const nonce=`${process.pid}-${randomBytes(6).toString("hex")}`;
  const outTmp=path.join(path.dirname(out),`.${path.basename(out)}.${nonce}.tmp`);
  const recTmp=path.join(path.dirname(rec),`.${path.basename(rec)}.${nonce}.tmp`);
  try {
    fsyncWrite(outTmp,outputBytes);
    fs.renameSync(outTmp,out);
    const finalReceipt={...receipt,output:{sha256:sha256(outputBytes),bytes:outputBytes.length,path:path.basename(out)}};
    fsyncWrite(recTmp,Buffer.from(`${JSON.stringify(finalReceipt,null,2)}\n`));
    fs.renameSync(recTmp,rec);
    return finalReceipt;
  } finally {
    for (const p of [outTmp,recTmp]) try { fs.unlinkSync(p); } catch (e) { if (e.code!=="ENOENT") throw e; }
  }
}
