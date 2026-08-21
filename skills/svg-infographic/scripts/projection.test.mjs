// projection.mjs contract tests — explicit opt-in derived output, honest classification,
// deterministic stdlib PNG composition, and content-plane protection.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  CODEC,
  GLOBAL_MIN_PROJECTED_SCALE,
  composeProjection,
  classifyCanonicalPair,
  decodePng,
  encodePng,
  maskBoundaryConnectedCanvas,
  pngChunk,
  projectImage,
  renderSignature,
  sha256,
  validateSurfaceManifest,
  writeProjectionTransaction,
} from "./projection-contract.mjs";
import {
  buildProjection,
  DEFAULT_PROJECTION_SURFACE,
  ProjectionError,
  resolveProjectionSurface,
  verifyProjection,
} from "./projection.mjs";

const sha = "a".repeat(64);
const manifest = () => ({
  schema_version: 1,
  id: "fixture-paper",
  asset: {
    path: "fixture-paper.png",
    sha256: sha,
    width: 8,
    height: 8,
    color_space: "srgb",
    license: "fixture-only",
    redistribution: "prohibited",
    provenance: { kind: "authored", creator: "test", created_on: "2026-08-20" },
  },
  content_plane: { kind: "rect", x: 2, y: 2, width: 4, height: 4 },
  safe_area: { x: 1, y: 1, width: 6, height: 6 },
  minimum_projected_scale: GLOBAL_MIN_PROJECTED_SCALE,
  layers: {
    shadow: { enabled: true, offset_x: 1, offset_y: 1, blur_radius: 1, opacity: 0.18 },
    grain: { enabled: true, seed: 17, amplitude: 2 },
    ambient_gradient: { enabled: false, from: "#000000", to: "#000000", opacity: 0 },
  },
  canvas_adaptation: null,
  blend_profile: "source-over-v1",
  signature_slot: { x: 5, y: 7, width: 2, height: 1, default: null, color: "#5b6675" },
  required_attribution: null,
});

test("projection routing: omitted surface resolves to bundled paper-notebook", () => {
  assert.equal(resolveProjectionSurface(),DEFAULT_PROJECTION_SURFACE);
  assert.equal(JSON.parse(fs.readFileSync(DEFAULT_PROJECTION_SURFACE,"utf8")).id,"paper-notebook");
});

test("projection routing: an explicit surface always overrides the default", () => {
  assert.equal(resolveProjectionSurface("/tmp/custom-surface.json"),"/tmp/custom-surface.json");
});

test("canonical classification: renderer gate failure is distinct", () => {
  assert.deepEqual(classifyCanonicalPair({ renderExit: 5 }), {
    classification: "canonical-validation-failed", cause: "render-exit-5",
  });
});

test("canonical classification: malformed or wrong-size supplied PNG is invalid", () => {
  assert.equal(classifyCanonicalPair({ renderExit: 0, suppliedValid: false }).classification, "canonical-pair-invalid");
});

test("canonical classification: same-size byte mismatch does not invent environment drift", () => {
  assert.deepEqual(classifyCanonicalPair({ renderExit: 0, suppliedValid: true, bytesEqual: false }), {
    classification: "canonical-bytes-mismatch", cause: "unavailable",
  });
});

test("canonical classification: exact pair passes", () => {
  assert.equal(classifyCanonicalPair({ renderExit: 0, suppliedValid: true, bytesEqual: true }).classification, "pass");
});

test("manifest: strict known-field contract accepts the bounded fixture", () => {
  const out = validateSurfaceManifest(manifest());
  assert.equal(out.id, "fixture-paper");
});

test("manifest: unknown fields fail closed", () => {
  const m = manifest();
  m.freeform_filter = "pretty";
  assert.throws(() => validateSurfaceManifest(m), /unknown field.*freeform_filter/);
});

test("manifest: a template cannot relax the global scale floor", () => {
  const m = manifest();
  m.minimum_projected_scale = GLOBAL_MIN_PROJECTED_SCALE - 0.01;
  assert.throws(() => validateSurfaceManifest(m), /minimum_projected_scale/);
});

test("manifest: content-over translucent/highlight layers are forbidden in v1", () => {
  const m = manifest();
  m.layers.highlight = { opacity: 0.02 };
  assert.throws(() => validateSurfaceManifest(m), /unknown field.*highlight|forbidden layer/);
});

test("manifest: arbitrary blend filters cannot masquerade as registered profiles", () => {
  const m=manifest();m.blend_profile="make-it-vintage";
  assert.throws(()=>validateSurfaceManifest(m),/blend_profile.*registered/);
});

test("manifest: dominant-border canvas adaptation has a closed confidence floor", () => {
  const m=manifest();
  m.canvas_adaptation={mode:"boundary-connected-dominant-border-exact-rgba",alpha:255,connectivity:4,minimum_border_share:0.5};
  assert.equal(validateSurfaceManifest(m).canvas_adaptation.minimum_border_share,0.5);
  m.canvas_adaptation.minimum_border_share=0.49;
  assert.throws(()=>validateSurfaceManifest(m),/minimum_border_share/);
});

test("manifest: path traversal and remote surface assets are forbidden", () => {
  for (const value of ["../surface.png", "https://example.test/surface.png", "/tmp/surface.png"]) {
    const m=manifest(); m.asset.path=value;
    assert.throws(()=>validateSurfaceManifest(m),/safe relative path/);
  }
});

test("manifest: generated assets require specific provenance and identifiable-work review", () => {
  const m=manifest(); m.asset.provenance={kind:"generated",creator:"test",created_on:"2026-08-20"};
  assert.throws(()=>validateSurfaceManifest(m),/provenance\.tool|identifiable/);
});

test("manifest: generated asset lineage binds the source digest and a strict normalization profile", () => {
  const m=manifest();
  m.asset.provenance={
    kind:"generated",creator:"test",created_on:"2026-08-20",tool:"fixture",tool_identifier:"fixture-1",
    terms_basis:"fixture-only",human_disposition:"accepted for test",identifiable_work_mark_character_absent:true,
    source_sha256:"b".repeat(64),normalization:{tool:"fixture",tool_version:"1",profile:"fixture-v1",operations:"none",performed_on:"2026-08-20"},
  };
  assert.equal(validateSurfaceManifest(m).asset.provenance.source_sha256,"b".repeat(64));
  m.asset.provenance.normalization.extra="silent-filter";
  assert.throws(()=>validateSurfaceManifest(m),/unknown field.*normalization\.extra/);
});

test("manifest: signature slot cannot intersect the protected content-plane box", () => {
  const m=manifest(); m.signature_slot={x:4,y:4,width:2,height:1,default:null,color:"#5b6675"};
  assert.throws(()=>validateSurfaceManifest(m),/signature_slot.*content plane/);
});

test("manifest: safe area must contain every content-plane corner", () => {
  const m = manifest();
  m.content_plane.x = 0;
  assert.throws(() => validateSurfaceManifest(m), /content plane.*safe area/);
});

test("PNG codec: fixed encoder is deterministic and round-trips RGBAs", () => {
  const rgba = Buffer.from([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 128,
  ]);
  const a = encodePng({ width: 2, height: 2, data: rgba });
  const b = encodePng({ width: 2, height: 2, data: rgba });
  assert.deepEqual(a, b);
  assert.equal(CODEC.scanline_filter, 4);
  assert.deepEqual(decodePng(a), { width: 2, height: 2, data: rgba });
});

test("PNG codec: ICC/profile-bearing input is rejected instead of silently reinterpreted", () => {
  const base=encodePng({width:1,height:1,data:Buffer.from([1,2,3,255])});
  const withIcc=Buffer.concat([base.subarray(0,33),pngChunk("iCCP",Buffer.from([120,0,0])),base.subarray(33)]);
  assert.throws(()=>decodePng(withIcc),/iCCP.*unsupported/);
});

test("projection: rect mapping preserves source corner colors", () => {
  const bg = { width: 4, height: 4, data: Buffer.alloc(4 * 4 * 4, 240) };
  for (let i = 3; i < bg.data.length; i += 4) bg.data[i] = 255;
  const src = {
    width: 2, height: 2,
    data: Buffer.from([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]),
  };
  const out = projectImage({ background: bg, source: src, plane: { kind: "rect", x: 1, y: 1, width: 2, height: 2 } });
  const at = (x, y) => [...out.data.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
  assert.deepEqual(at(1, 1), [255, 0, 0, 255]);
  assert.deepEqual(at(2, 2), [255, 255, 255, 255]);
});

test("projection: bounded quad uses the same inverse mapping process", () => {
  const bg={width:3,height:3,data:Buffer.alloc(3*3*4,0)}; for(let i=3;i<bg.data.length;i+=4)bg.data[i]=255;
  const src={width:2,height:2,data:Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255])};
  const out=projectImage({background:bg,source:src,plane:{kind:"quad",points:[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}]}});
  const at=(x,y)=>[...out.data.subarray((y*3+x)*4,(y*3+x)*4+4)];
  assert.deepEqual(at(0,0),[255,0,0,255]); assert.deepEqual(at(2,2),[255,255,255,255]);
});

test("background-only seeded layers are deterministic and projection overwrites the protected plane", () => {
  const bg={width:4,height:4,data:Buffer.alloc(4*4*4,200)}; for(let i=3;i<bg.data.length;i+=4)bg.data[i]=255;
  const src={width:2,height:2,data:Buffer.from(Array(4).fill([10,20,30,255]).flat())};
  const layers=manifest().layers;
  const a=composeProjection({background:bg,source:src,plane:{kind:"rect",x:1,y:1,width:2,height:2},layers});
  const b=composeProjection({background:bg,source:src,plane:{kind:"rect",x:1,y:1,width:2,height:2},layers});
  assert.deepEqual(a.data,b.data);
  assert.deepEqual([...a.data.subarray((1*4+1)*4,(1*4+1)*4+4)],[10,20,30,255]);
});

test("canvas adaptation removes only exact canvas pixels connected to the source boundary", () => {
  const data=Buffer.alloc(5*5*4,255);
  const set=(x,y,r,g,b,a=255)=>{const d=(y*5+x)*4;data[d]=r;data[d+1]=g;data[d+2]=b;data[d+3]=a;};
  for(let y=1;y<4;y++)for(let x=1;x<4;x++)set(x,y,0,0,0);
  set(2,2,255,255,255);
  const masked=maskBoundaryConnectedCanvas({width:5,height:5,data},{mode:"boundary-connected-exact-rgba",color:"#ffffff",alpha:255,connectivity:4});
  assert.equal(masked.masked_pixels,16);
  assert.equal(masked.data[(0*5+0)*4+3],0);
  assert.equal(masked.data[(2*5+2)*4+3],255);
});

test("canvas adaptation resolves the dominant exact border color without erasing edge artwork", () => {
  const data=Buffer.from(Array(25).fill([247,248,252,255]).flat());
  const set=(x,y,rgba)=>data.set(rgba,(y*5+x)*4);
  set(4,0,[240,237,254,255]);
  for(let y=1;y<4;y++)for(let x=1;x<4;x++)set(x,y,[20,30,40,255]);
  set(2,2,[247,248,252,255]);
  const masked=maskBoundaryConnectedCanvas({width:5,height:5,data},{mode:"boundary-connected-dominant-border-exact-rgba",alpha:255,connectivity:4,minimum_border_share:0.5});
  assert.deepEqual(masked.canvas_adaptation.target_rgba,[247,248,252,255]);
  assert.equal(masked.data[(0*5+0)*4+3],0);
  assert.equal(masked.data[(0*5+4)*4+3],255);
  assert.equal(masked.data[(2*5+2)*4+3],255);
});

test("canvas adaptation fails closed when no border color reaches the declared share", () => {
  const data=Buffer.from([[1,2,3,255],[4,5,6,255],[7,8,9,255],[10,11,12,255]].flat());
  assert.throws(()=>maskBoundaryConnectedCanvas({width:2,height:2,data},{mode:"boundary-connected-dominant-border-exact-rgba",alpha:255,connectivity:4,minimum_border_share:0.5}),/dominant border share/);
});

test("canvas adaptation reveals the registered surface instead of painting a white sheet", () => {
  const background={width:3,height:3,data:Buffer.from(Array(9).fill([230,220,200,255]).flat())};
  const sourceData=Buffer.from(Array(9).fill([255,255,255,255]).flat());
  sourceData.set([20,40,60,255],(1*3+1)*4);
  const layers=manifest().layers;
  layers.shadow.enabled=false;layers.grain.enabled=false;layers.ambient_gradient.enabled=false;
  const out=composeProjection({background,source:{width:3,height:3,data:sourceData},plane:{kind:"rect",x:0,y:0,width:3,height:3},layers,canvasAdaptation:{mode:"boundary-connected-exact-rgba",color:"#ffffff",alpha:255,connectivity:4}});
  assert.deepEqual([...out.data.subarray(0,4)],[230,220,200,255]);
  assert.deepEqual([...out.data.subarray((1*3+1)*4,(1*3+1)*4+4)],[20,40,60,255]);
});

test("ink-on-surface profile passes white through and prints color into the surface", () => {
  const background={width:2,height:2,data:Buffer.from(Array(4).fill([240,220,190,255]).flat())};
  const source={width:2,height:2,data:Buffer.from([[255,255,255,255],[31,111,178,255],[255,255,255,255],[31,111,178,255]].flat())};
  const layers=manifest().layers;layers.shadow.enabled=false;layers.grain.enabled=false;layers.ambient_gradient.enabled=false;
  const out=composeProjection({background,source,plane:{kind:"rect",x:0,y:0,width:2,height:2},layers,blendProfile:"ink-on-surface-v1"});
  assert.deepEqual([...out.data.subarray(0,4)],[240,220,190,255]);
  assert.deepEqual([...out.data.subarray(4,8)],[38,95,125,255]);
});

test("signature: bundled ASCII glyphs render deterministically inside the declared slot", () => {
  const image={width:64,height:16,data:Buffer.alloc(64*16*4,255)};
  const slot={x:4,y:2,width:56,height:12,color:"#123456"};
  const a=renderSignature(image,slot,"a.io"),b=renderSignature(image,slot,"a.io");
  assert.deepEqual(a.data,b.data);
  assert.notDeepEqual(a.data,renderSignature(image,slot,"A.IO").data);
  assert.deepEqual([...a.data.subarray((7*64+59)*4,(7*64+59)*4+4)],[0x12,0x34,0x56,255]);
  assert.throws(()=>renderSignature(image,slot,"한글" /* lang-allow: ko-fixture */),/v1 ASCII set/);
});

test("transaction: output and digest-bound receipt finalize together", () => {
  const td = fs.mkdtempSync(path.join(os.tmpdir(), "projection-tx-"));
  const out = path.join(td, "projection.png");
  const receipt = path.join(td, "projection.receipt.json");
  const png = encodePng({ width: 1, height: 1, data: Buffer.from([1, 2, 3, 255]) });
  writeProjectionTransaction({ outputPath: out, receiptPath: receipt, outputBytes: png, receipt: { schema_version: 1 } });
  assert.deepEqual(fs.readFileSync(out), png);
  const r = JSON.parse(fs.readFileSync(receipt, "utf8"));
  assert.match(r.output.sha256, /^[0-9a-f]{64}$/);
  assert.equal(r.output.bytes, png.length);
});

function projectionFixture() {
  const td=fs.mkdtempSync(path.join(os.tmpdir(),"projection-e2e-"));
  const svg=path.join(td,"diagram.svg"), canonical=path.join(td,"diagram.png"), asset=path.join(td,"surface.png");
  const surface=path.join(td,"surface.json"), out=path.join(td,"out.png"), receipt=path.join(td,"out.receipt.json");
  fs.writeFileSync(svg,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><title>x</title><desc>x</desc><rect width="1" height="1" fill="#FFFFFF"/></svg>');
  const canonicalBytes=encodePng({width:2,height:2,data:Buffer.from([
    255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255,
  ])});
  const bg=Buffer.alloc(8*8*4,238); for(let i=3;i<bg.length;i+=4)bg[i]=255;
  const assetBytes=encodePng({width:8,height:8,data:bg});
  fs.writeFileSync(canonical,canonicalBytes); fs.writeFileSync(asset,assetBytes);
  const m=manifest(); m.asset.path=path.basename(asset); m.asset.sha256=sha256(assetBytes);
  fs.writeFileSync(surface,`${JSON.stringify(m,null,2)}\n`);
  const runRender=({outPath})=>{fs.copyFileSync(canonical,outPath);return{status:0,stdout:"renderer: fixture-chromium 1 [via test]\n",stderr:""};};
  return {td,svg,canonical,asset,surface,out,receipt,canonicalBytes,runRender};
}

test("build/verify: explicit sibling produces a reproducible derived output without touching canonical inputs", () => {
  const f=projectionFixture();
  const svgBefore=fs.readFileSync(f.svg), pngBefore=fs.readFileSync(f.canonical);
  const receipt=buildProjection({svgPath:f.svg,canonicalPngPath:f.canonical,manifestPath:f.surface,outPath:f.out,receiptPath:f.receipt},{runRender:f.runRender});
  assert.equal(receipt.status,"pass"); assert.ok(fs.existsSync(f.out)); assert.ok(fs.existsSync(f.receipt));
  assert.deepEqual(fs.readFileSync(f.svg),svgBefore); assert.deepEqual(fs.readFileSync(f.canonical),pngBefore);
  assert.equal(verifyProjection({outPath:f.out,receiptPath:f.receipt},{runRender:f.runRender}).classification,"pass");
});

test("verify: output tamper is red even when a receipt remains", () => {
  const f=projectionFixture();
  buildProjection({svgPath:f.svg,canonicalPngPath:f.canonical,manifestPath:f.surface,outPath:f.out,receiptPath:f.receipt},{runRender:f.runRender});
  const bytes=fs.readFileSync(f.out); bytes[bytes.length-1]^=1; fs.writeFileSync(f.out,bytes);
  assert.throws(()=>verifyProjection({outPath:f.out,receiptPath:f.receipt},{runRender:f.runRender}),/output digest|PNG IEND CRC|projection verify failed/);
});

test("verify: declared blend profile remains receipt-bound", () => {
  const f=projectionFixture();
  buildProjection({svgPath:f.svg,canonicalPngPath:f.canonical,manifestPath:f.surface,outPath:f.out,receiptPath:f.receipt},{runRender:f.runRender});
  const receipt=JSON.parse(fs.readFileSync(f.receipt,"utf8"));
  receipt.blend_profile="ink-on-surface-v1";
  fs.writeFileSync(f.receipt,`${JSON.stringify(receipt,null,2)}\n`);
  assert.throws(()=>verifyProjection({outPath:f.out,receiptPath:f.receipt},{runRender:f.runRender}),/blend profile/);
});

test("full-entrypoint anchor: lint-fail SVG is rejected before output writes", () => {
  const f=projectionFixture();
  fs.writeFileSync(f.svg,'<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.throws(()=>buildProjection({svgPath:f.svg,canonicalPngPath:f.canonical,manifestPath:f.surface,outPath:f.out,receiptPath:f.receipt}),
    (error)=>error instanceof ProjectionError&&error.classification==="canonical-validation-failed");
  assert.equal(fs.existsSync(f.out),false); assert.equal(fs.existsSync(f.receipt),false);
});
