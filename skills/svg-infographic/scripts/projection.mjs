#!/usr/bin/env node
// projection.mjs — explicit opt-in verified canonical PNG -> presentation surface projection.
// Default svg-infographic rendering never calls this file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
import { preflight } from "./preflight-lib.mjs";
import {
  CODEC, GLOBAL_MIN_PROJECTED_SCALE, classifyCanonicalPair, composeProjection, decodePng, encodePng,
  projectedScale, renderSignature, sha256, validateSurfaceManifest, writeProjectionTransaction,
} from "./projection-contract.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const packageRoot=path.resolve(here,"..");
const renderCli=path.join(here,"render.mjs");
export const DEFAULT_PROJECTION_SURFACE=path.join(packageRoot,"references","presentation","surfaces","paper-notebook.json");

export function resolveProjectionSurface(surfacePath){return surfacePath??DEFAULT_PROJECTION_SURFACE;}

export class ProjectionError extends Error {
  constructor(message,{exitCode=1,classification="projection-invalid"}={}){super(message);this.exitCode=exitCode;this.classification=classification;}
}
function posix(value){return value.split(path.sep).join("/");}
function locator(fromDir,target){return posix(path.relative(fromDir,path.resolve(target))||path.basename(target));}
function resolveLocator(fromDir,value){
  if(typeof value!=="string"||!value||path.isAbsolute(value))throw new ProjectionError("receipt locator must be relative",{classification:"receipt-invalid"});
  return path.resolve(fromDir,value);
}
function safeContained(base,candidate,label){
  const b=realpathSync(base), c=realpathSync(candidate);
  if(c!==b&&!c.startsWith(`${b}${path.sep}`))throw new ProjectionError(`${label} resolves outside its allowed root`,{classification:"surface-path-invalid"});
  return c;
}
function assetPath(manifestPath,relative){
  const manifestReal=realpathSync(manifestPath);
  const inPackage=manifestReal===packageRoot||manifestReal.startsWith(`${realpathSync(packageRoot)}${path.sep}`);
  const base=inPackage?packageRoot:path.dirname(manifestReal);
  return safeContained(base,path.resolve(base,relative),"surface asset");
}
function parseRenderer(output){
  const line=String(output).split(/\r?\n/).find((v)=>v.startsWith("renderer: "))??null;
  return line?line.slice("renderer: ".length):null;
}
function defaultRenderRunner({svgPath,outPath}){
  const r=spawnSync(process.execPath,[renderCli,svgPath,outPath],{
    encoding:"utf8",timeout:150000,env:process.env,maxBuffer:32*1024*1024,
  });
  return {status:r.status??3,stdout:r.stdout??"",stderr:r.stderr??""};
}
function readJson(file,label){
  try{return JSON.parse(fs.readFileSync(file,"utf8"));}
  catch(error){throw new ProjectionError(`${label} is not valid JSON: ${error.message}`,{classification:`${label}-invalid`});}
}
function requireFile(file,label){
  if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())throw new ProjectionError(`${label} not found: ${file??""}`);
  return realpathSync(file);
}
function verifyPngOrNull(bytes){try{return decodePng(bytes);}catch{return null;}}

export function computeProjection({svgPath,canonicalPngPath,manifestPath,signature=null},{runRender=defaultRenderRunner}={}){
  svgPath=requireFile(svgPath,"source SVG"); canonicalPngPath=requireFile(canonicalPngPath,"canonical PNG");
  manifestPath=requireFile(manifestPath,"surface manifest");
  const svgBefore=fs.readFileSync(svgPath), pngBefore=fs.readFileSync(canonicalPngPath), manifestBytes=fs.readFileSync(manifestPath);
  const manifest=validateSurfaceManifest(readJson(manifestPath,"surface-manifest"));
  if(manifest.required_attribution!==null)throw new ProjectionError("required attribution needs a deterministic rendered layer; refusing to drop it",{classification:"attribution-unsupported"});
  const surfaceAssetPath=assetPath(manifestPath,manifest.asset.path);
  const assetBytes=fs.readFileSync(surfaceAssetPath);
  if(sha256(assetBytes)!==manifest.asset.sha256)throw new ProjectionError("surface asset digest mismatch",{classification:"surface-asset-mismatch"});
  if(assetBytes.length>3*1024*1024)throw new ProjectionError("surface asset exceeds the 3 MiB selected-asset budget",{classification:"surface-budget-exceeded"});
  const background=decodePng(assetBytes);
  if(background.width!==manifest.asset.width||background.height!==manifest.asset.height)
    throw new ProjectionError("surface asset dimensions differ from manifest",{classification:"surface-asset-mismatch"});

  const td=fs.mkdtempSync(path.join(os.tmpdir(),"svginfo-projection-"));
  const regenerated=path.join(td,"canonical.png");
  let run, classification, supplied=null, regeneratedBytes=null, regeneratedPng=null;
  try{
    run=runRender({svgPath,outPath:regenerated});
    if(run.status===0&&fs.existsSync(regenerated)){
      regeneratedBytes=fs.readFileSync(regenerated);
      regeneratedPng=verifyPngOrNull(regeneratedBytes);
      supplied=verifyPngOrNull(pngBefore);
    }
    const suppliedValid=Boolean(supplied&&regeneratedPng&&supplied.width===regeneratedPng.width&&supplied.height===regeneratedPng.height);
    classification=classifyCanonicalPair({renderExit:run.status,suppliedValid,bytesEqual:suppliedValid&&pngBefore.equals(regeneratedBytes)});
    if(classification.classification!=="pass"){
      const detail=(run.stdout??"")+(run.stderr??"");
      throw new ProjectionError(`${classification.classification}: ${classification.cause}${detail?`\n${detail.trim()}`:""}`,{
        exitCode:classification.classification==="canonical-validation-failed"?10:11,
        classification:classification.classification,
      });
    }
    const scale=projectedScale({source:supplied,plane:manifest.content_plane});
    if(scale+1e-12<manifest.minimum_projected_scale)
      throw new ProjectionError(`projected scale ${scale.toFixed(6)} is below floor ${manifest.minimum_projected_scale}`,{classification:"projected-scale-below-floor"});
    const composed=composeProjection({background,source:supplied,plane:manifest.content_plane,layers:manifest.layers,canvasAdaptation:manifest.canvas_adaptation??null,blendProfile:manifest.blend_profile});
    let finalImage=composed;
    try{if(signature!==null)finalImage=renderSignature(composed,manifest.signature_slot,signature);}
    catch(error){throw new ProjectionError(error.message,{classification:"signature-invalid"});}
    const outputBytes=encodePng(finalImage);
    if(!fs.readFileSync(svgPath).equals(svgBefore)||!fs.readFileSync(canonicalPngPath).equals(pngBefore))
      throw new ProjectionError("canonical input bytes changed during projection",{classification:"canonical-input-mutated"});
    return {
      outputBytes, manifest, surfaceAssetPath,
      evidence:{
        canonical_verification:{
          classification:"pass",cause:null,render_exit:run.status,renderer:parseRenderer(run.stdout),
          stdout_sha256:sha256(Buffer.from(run.stdout??"")),stderr_sha256:sha256(Buffer.from(run.stderr??"")),
          regenerated_png_sha256:sha256(regeneratedBytes),supplied_png_sha256:sha256(pngBefore),
        },
        inputDigests:{svg:sha256(svgBefore),canonicalPng:sha256(pngBefore),manifest:sha256(manifestBytes),asset:sha256(assetBytes)},
        dimensions:{canonical:{width:supplied.width,height:supplied.height},output:{width:finalImage.width,height:finalImage.height}},
        geometry:{content_plane:manifest.content_plane,safe_area:manifest.safe_area,projected_scale:scale,minimum_projected_scale:manifest.minimum_projected_scale},
        canvas_adaptation:composed.canvas_adaptation??null,
      },
    };
  }finally{fs.rmSync(td,{recursive:true,force:true});}
}

function receiptBase({computed,svgPath,canonicalPngPath,manifestPath,receiptPath,signature}){
  const base=path.dirname(path.resolve(receiptPath));
  return {
    schema:{name:"svg-infographic-projection-receipt",version:1},status:"pass",classification:"projection-pass",
    inputs:{
      svg:{locator:locator(base,svgPath),sha256:computed.evidence.inputDigests.svg},
      canonical_png:{locator:locator(base,canonicalPngPath),sha256:computed.evidence.inputDigests.canonicalPng},
    },
    canonical_verification:computed.evidence.canonical_verification,
    surface:{
      id:computed.manifest.id,manifest_locator:locator(base,manifestPath),manifest_sha256:computed.evidence.inputDigests.manifest,
      asset_sha256:computed.evidence.inputDigests.asset,
    },
    geometry:computed.evidence.geometry,
    layers:computed.manifest.layers,
    canvas_adaptation:{declared:computed.manifest.canvas_adaptation??null,resolved:computed.evidence.canvas_adaptation??null},
    blend_profile:computed.manifest.blend_profile,
    compositor:{...CODEC,node:process.version,zlib:process.versions.zlib},
    signature:signature===null?{requested:false,status:"absent"}:{requested:true,status:"rendered",value:signature,sha256:sha256(Buffer.from(signature,"utf8"))},
    attribution:{required:null,status:"not-required"},
  };
}

export function buildProjection({svgPath,canonicalPngPath,manifestPath,outPath,receiptPath=`${outPath}.receipt.json`,signature=null},deps={}){
  if(!outPath)throw new ProjectionError("--out is required");
  const computed=computeProjection({svgPath,canonicalPngPath,manifestPath,signature},deps);
  const receipt=receiptBase({computed,svgPath,canonicalPngPath,manifestPath,receiptPath,signature});
  return writeProjectionTransaction({outputPath:outPath,receiptPath,outputBytes:computed.outputBytes,receipt});
}

export function verifyProjection({outPath,receiptPath},deps={}){
  outPath=requireFile(outPath,"projection output"); receiptPath=requireFile(receiptPath,"projection receipt");
  const receipt=readJson(receiptPath,"projection-receipt");
  if(receipt.schema?.name!=="svg-infographic-projection-receipt"||receipt.schema?.version!==1||receipt.status!=="pass")
    throw new ProjectionError("projection receipt schema/status is invalid",{exitCode:12,classification:"receipt-invalid"});
  const base=path.dirname(receiptPath);
  const svgPath=resolveLocator(base,receipt.inputs?.svg?.locator);
  const canonicalPngPath=resolveLocator(base,receipt.inputs?.canonical_png?.locator);
  const manifestPath=resolveLocator(base,receipt.surface?.manifest_locator);
  const signature=receipt.signature?.requested===true?receipt.signature?.value:null;
  if(receipt.signature?.requested===true&&(receipt.signature?.status!=="rendered"||typeof signature!=="string"||sha256(Buffer.from(signature,"utf8"))!==receipt.signature?.sha256))
    throw new ProjectionError("signature receipt binding is invalid",{exitCode:12,classification:"receipt-invalid"});
  const computed=computeProjection({svgPath,canonicalPngPath,manifestPath,signature},deps);
  const outputBytes=fs.readFileSync(outPath);
  const errors=[];
  const eq=(actual,expected,label)=>{if(actual!==expected)errors.push(`${label}: ${actual} != ${expected}`);};
  eq(sha256(outputBytes),receipt.output?.sha256,"output digest");
  eq(outputBytes.length,receipt.output?.bytes,"output bytes");
  eq(sha256(computed.outputBytes),receipt.output?.sha256,"regenerated output digest");
  eq(computed.evidence.inputDigests.svg,receipt.inputs?.svg?.sha256,"SVG digest");
  eq(computed.evidence.inputDigests.canonicalPng,receipt.inputs?.canonical_png?.sha256,"canonical PNG digest");
  eq(computed.evidence.inputDigests.manifest,receipt.surface?.manifest_sha256,"manifest digest");
  eq(computed.evidence.inputDigests.asset,receipt.surface?.asset_sha256,"surface asset digest");
  eq(JSON.stringify(computed.manifest.canvas_adaptation??null),JSON.stringify(receipt.canvas_adaptation?.declared??null),"canvas adaptation declaration");
  eq(JSON.stringify(computed.evidence.canvas_adaptation??null),JSON.stringify(receipt.canvas_adaptation?.resolved??null),"canvas adaptation resolution");
  eq(computed.manifest.blend_profile,receipt.blend_profile,"blend profile");
  eq(CODEC.id,receipt.compositor?.id,"codec id");
  eq(CODEC.resampling_kernel,receipt.compositor?.resampling_kernel,"kernel id");
  if(errors.length)throw new ProjectionError(`projection verify failed:\n- ${errors.join("\n- ")}`,{exitCode:12,classification:"projection-verify-failed"});
  return {classification:"pass",output_sha256:receipt.output.sha256};
}

function usage(){
  console.error("usage:\n  node projection.mjs build --svg <file> --canonical-png <file> [--surface <manifest.json>] --out <file> [--receipt <file>]\n    default projection surface: paper-notebook\n  node projection.mjs verify --receipt <file> --out <file>");
}
function options(argv){
  const command=argv[0],known=new Set(["--svg","--canonical-png","--surface","--out","--receipt","--signature"]),out={command};
  for(let i=1;i<argv.length;i++){
    const key=argv[i]; if(!known.has(key)||i+1>=argv.length)throw new ProjectionError(`unknown or incomplete option: ${key}`);
    const name=key.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); if(name in out)throw new ProjectionError(`duplicate option: ${key}`);
    out[name]=argv[++i];
  }
  return out;
}
export function main(argv){
  if(argv.includes("-h")||argv.includes("--help")){usage();return 0;}
  try{
    const o=options(argv);
    if(o.command==="build"){
      const receipt=buildProjection({svgPath:o.svg,canonicalPngPath:o.canonicalPng,manifestPath:resolveProjectionSurface(o.surface),outPath:o.out,receiptPath:o.receipt??`${o.out}.receipt.json`,signature:o.signature??null});
      console.log(`projection: pass  ${o.out}  sha256:${receipt.output.sha256}`); return 0;
    }
    if(o.command==="verify"){
      const result=verifyProjection({outPath:o.out,receiptPath:o.receipt});
      console.log(`projection verify: pass  sha256:${result.output_sha256}`); return 0;
    }
    usage(); return 1;
  }catch(error){
    console.error(`${error.classification??"projection-error"}: ${error.message}`); return error.exitCode??1;
  }
}

const isMain=(()=>{try{return realpathSync(fileURLToPath(import.meta.url))===realpathSync(process.argv[1]);}catch{return import.meta.url===pathToFileURL(process.argv[1]??"").href;}})();
if(isMain){preflight({entrypointUrl:import.meta.url});process.exit(main(process.argv.slice(2)));}
