<!-- English: [README.md](./README.md) -->

# Agent Skills

AI 코딩 에이전트가 실제 작업에서 바로 써먹을 수 있는 skill 모음입니다. 첫 번째 skill은 아주 구체적인 문제를 해결합니다: 텍스트 설명을 깔끔한 기술 다이어그램과 인포그래픽 파일로 바꾸기.

[`svg-infographic`](./skills/svg-infographic)은 Claude Code에서 아키텍처 설명, 마이그레이션 계획, 프로세스 흐름, 기술 개념을 편집 가능한 SVG와 선명한 2x PNG로 만들어 줍니다. 문서, 제안서, 슬라이드, 소셜 포스트에 바로 넣을 수 있는 형태를 목표로 합니다.

[![svg-infographic 예제 갤러리](./examples/svg-infographic/gallery-preview.ko.png)](./examples/svg-infographic)

## 왜 만들었나

Claude 앱에서는 시각 자료를 만들기 쉽지만, Claude Code에서는 보통 저장소 안에서 작업합니다. 그래서 “그럴듯한 그림”보다 실제 파일이 필요합니다. 나중에 고칠 수 있는 SVG, 바로 공유할 수 있는 PNG, 한국어가 깨지지 않는 폰트와 렌더링 확인까지요.

`svg-infographic`은 Claude Code가 그런 산출물을 안정적으로 만들도록 돕는 workflow입니다. 결과물은 flat하고 구조적이며, repo에 넣어 관리하기 좋게 만듭니다.

## 만들 수 있는 것

| 용도 | 예시 |
| --- | --- |
| 아키텍처 / 클라우드 토폴로지 | Azure / AWS 요청 경로, 네트워크 구역, 서비스, 데이터베이스 |
| 기술 인포그래픽 | 레이어 모델, capability map, 한 장짜리 설명 자료 |
| Before / After 비교 | 마이그레이션, 현대화, 개선 전후 비교 |
| 프로세스 / 데이터 플로우 | RAG 파이프라인, 승인 흐름, 시스템 handoff |
| 로드맵 / 타임라인 | 제품 단계, 마일스톤, 현재 상태 |
| 한국어 공유 이미지 | CJK 렌더링을 확인한 SVG + PNG 산출물 |

전체 [예제 갤러리](./examples/svg-infographic)에서 6가지 archetype을 영문·한글 버전과 생성 프롬프트로 확인할 수 있습니다.

## 빠른 시작

Claude Code용 첫 skill을 설치합니다:

```bash
git clone --depth 1 https://github.com/kyungseo/agent-skills.git /tmp/agent-skills
mkdir -p ~/.claude/skills
cp -R /tmp/agent-skills/skills/svg-infographic ~/.claude/skills/
```

Windows PowerShell, 버전 고정 설치, 업데이트, 제거 방법은 [`docs/INSTALL.md`](./docs/INSTALL.md)에 있습니다.

이후 Claude Code에서 이렇게 요청합니다:

```text
svg-infographic으로 Azure 토폴로지를 그려줘: Application Gateway -> APIM -> AKS -> PostgreSQL.
```

```text
svg-infographic으로 이 before/after 마이그레이션 계획을 슬라이드용 기술 인포그래픽으로 바꿔줘.
```

결과물은 다음 두 파일을 기본으로 합니다:

- `*.svg` — 나중에 고칠 수 있는 원본
- `*.png` — 공유, 슬라이드, 소셜 포스트용 2x export

## Skill 목록

| Skill | Agent | Status | 설명 |
| --- | --- | --- | --- |
| [`svg-infographic`](./skills/svg-infographic) | Claude Code | Beta | flat하고 구조적인 SVG 인포그래픽을 만들고 PNG로 export합니다. |

## 품질 기준

포함된 예제는 모두 직접 만든 synthetic 예제이며, client 산출물에서 파생하지 않았습니다. 각 예제는 SVG + 2x PNG로 제공되고 다음을 확인합니다:

- 텍스트 넘침 없음
- 한국어/CJK 글자 깨짐 없음
- SVG/PNG 크기 일치
- SVG 접근성 메타데이터 포함
- host-specific path 또는 client path 없음

## 현재 범위

이 repo는 우선 Claude Code를 대상으로 합니다. Codex / Codex CLI 지원은 수요와 browser 기반 PNG export 경로가 확인되면 다시 검토합니다.

`svg-infographic`은 flat하고 구조적인 시각 자료에 초점을 둡니다. 사진 중심 마케팅 그래픽, 통계 차트, 손그림/크레용 스타일, 마스코트·캐릭터 일러스트는 의도적으로 범위 밖에 둡니다.

## 라이선스

[Apache-2.0](./LICENSE).
