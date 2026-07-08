<!-- English: [README.md](./README.md) -->

# Skillstead

Agentic coding workflow에 붙여 쓰는 실용적이고 portable한 skill catalog입니다.

> [!TIP]
> **Skillstead = skill + homestead.** coding agent가 사용할 실용적인 skill을 하나씩 모아 두는 작은 터전이라는 뜻입니다. 첫 skill은 `svg-infographic`입니다.

첫 번째 skill은 아주 구체적인 문제를 해결합니다: 텍스트 설명을 깔끔한 기술 다이어그램과 인포그래픽 파일로 바꾸기.

첫 release는 Claude Code 설치 경로부터 지원합니다. [`svg-infographic`](./skills/svg-infographic)은 아키텍처 설명, 마이그레이션 계획, 프로세스 흐름, 의사결정 매트릭스, 기술 개념을 편집 가능한 SVG와 선명한 2x PNG로 만들어 줍니다. 문서, 제안서, 슬라이드, 소셜 포스트에 바로 넣을 수 있는 형태를 목표로 합니다.

[![svg-infographic 예제 갤러리](./examples/svg-infographic/gallery-preview.ko.png)](./examples/svg-infographic)

## 왜 만들었나

Agentic coding workflow는 보통 저장소 안에서 진행됩니다. 그래서 “그럴듯한 그림”보다 실제 파일이 필요합니다. 나중에 고칠 수 있는 SVG, 바로 공유할 수 있는 PNG, 한국어가 깨지지 않는 폰트와 렌더링 확인까지요.

`svg-infographic`은 agent가 그런 산출물을 안정적으로 만들도록 돕는 workflow입니다. 결과물은 flat하고 구조적이며, repo에 넣어 관리하기 좋게 만듭니다.

## 만들 수 있는 것

| 용도 | 예시 |
| --- | --- |
| 아키텍처 / 클라우드 토폴로지 | Azure / AWS 요청 경로, 네트워크 구역, 서비스, 데이터베이스 |
| 기술 인포그래픽 | 레이어 모델, capability map, 한 장짜리 설명 자료 |
| Before / After 비교 | 마이그레이션, 현대화, 개선 전후 비교 |
| 프로세스 / 데이터 플로우 | RAG 파이프라인, 승인 흐름, 시스템 handoff |
| 로드맵 / 타임라인 | 제품 단계, 마일스톤, 현재 상태 |
| 의사결정 / 우선순위 매트릭스 | 2×2 quadrant map, 범위·불확실성 그리드, 트레이드오프 뷰 |
| 한국어 공유 이미지 | CJK 렌더링을 확인한 SVG + PNG 산출물 |

전체 [예제 갤러리](./examples/svg-infographic)에서 여러 archetype을 다루는 8개 예제 — architecture, migration, workflow, decision matrix 등 — 를 영문·한글 버전과 생성 프롬프트로 확인할 수 있습니다.

## 빠른 시작

현재 Claude Code package를 설치합니다:

```bash
git clone --depth 1 https://github.com/kyungseo/skillstead.git /tmp/skillstead
mkdir -p ~/.claude/skills
cp -R /tmp/skillstead/skills/svg-infographic ~/.claude/skills/
```

**프로젝트 단위**로 설치할 수도 있습니다(repo의 `.claude/skills/`에 두면 팀원이 clone만으로 사용). 프로젝트 단위 설치, Windows PowerShell, 버전 고정 설치, 업데이트, 제거 방법은 [`docs/INSTALL.md`](./docs/INSTALL.md)에 있습니다.

이후 Claude Code agent에게 이렇게 요청합니다:

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

현재는 검증된 첫 skill부터 시작합니다. 같은 수준의 evidence와 example 품질 기준을 만족하는 skill만 추가합니다.

| Skill | 지원 runtime | Status | 설명 |
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

Skillstead는 multi-agent skill catalog를 지향합니다. v0.1.0 release는 Claude Code 설치 경로와 browser 기반 PNG export workflow가 검증된 상태라 Claude Code first로 제공합니다. Codex / Codex CLI와 다른 agent runtime 지원은 수요와 export 경로가 확인되면 다시 검토합니다.

`svg-infographic`은 flat하고 구조적인 시각 자료에 초점을 둡니다. 사진 중심 마케팅 그래픽, 통계 차트, 손그림/크레용 스타일, 마스코트·캐릭터 일러스트는 의도적으로 범위 밖에 둡니다.

## 라이선스

[Apache-2.0](./LICENSE).
