#!/usr/bin/env node
// run-cli.mjs — fixture 전용 진입점 (verification surface, 배포 production 표면 아님).
//
// 목적: negative fixture가 package-owned lookup을 임시 디렉터리로 돌려야 할 때
// (SKIN_SKINS_DIR 등) production CLI에 사용자 옵션을 새로 뚫지 않기 위한
// dependency injection 지점이다. production 실행에서는 같은 override가
// preflight에 의해 거부된다.
//
// usage: node testing/run-cli.mjs <production-cli.mjs> [args...]
import path from "node:path";
import { pathToFileURL } from "node:url";
import { enableFixtureMode } from "../preflight-lib.mjs";

const [cli, ...rest] = process.argv.slice(2);
if (!cli) { console.error("usage: run-cli.mjs <production-cli.mjs> [args...]"); process.exit(2); }
const target = path.resolve(cli);
// production 모듈의 isMain 판정과 인자 파싱이 직접 실행과 동일하게 보이도록 argv를 교체한다.
process.argv = [process.argv[0], target, ...rest];
enableFixtureMode();
await import(pathToFileURL(target).href);
