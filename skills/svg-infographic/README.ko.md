<!-- English: [README.md](./README.md) -->

# svg-infographic

일관된 스타일 시스템으로 technical/structured SVG 인포그래픽을 작성하고, 편집 가능한 SVG와 선명한 2x PNG artifact를 함께 export한다.

## 개요

`svg-infographic`은 Claude Code가 아키텍처 다이어그램, 클라우드 토폴로지, before/after 비교, 프로세스 플로우, 로드맵 패널, 구조적인 한 장짜리 technical 인포그래픽을 깔끔한 hand-authored SVG로 작성하도록 돕는다.

**사진·일러스트 중심 마케팅 그래픽, 통계 차트, 손그림/크레용 스케치노트, 마스코트·캐릭터 일러스트에는 사용하지 않는다.**

한국어를 비롯한 CJK 텍스트가 깨지지 않고 올바르게 렌더되도록 폰트 스택과 glyph 확인을 기본으로 둔다.

## 언제 사용하나

- 텍스트 설명에서 깔끔한 아키텍처 / 토폴로지 / 플로우 / 레이어 다이어그램을 만들고 싶을 때.
- 덱, 문서, 소셜 포스트에 넣을 구조적인 technical 한 장짜리 자료가 필요할 때.
- 출력에 한국어 / CJK 텍스트가 정확히 들어가야 할 때.

## 언제 사용하지 않나

- 사진·일러스트 중심 마케팅 인포그래픽.
- 통계 차트(막대, 선, 산점도, 히트맵).
- 손그림 / 크레용 스케치노트 스타일, 마스코트, 캐릭터 일러스트.

## 설치

skill 폴더를 Claude Code skills 디렉터리에 복사한다.

```text
<claude-skills-dir>/svg-infographic/SKILL.md
```

정확한 경로는 환경마다 다르므로 이 문서는 machine-specific 절대 경로 대신 `<claude-skills-dir>` placeholder를 쓴다. [../../docs/INSTALL.md](../../docs/INSTALL.md) 참고.

## 사용 예시 (프롬프트)

```text
svg-infographic으로 이 아키텍처를 클라우드 인프라 토폴로지 다이어그램으로 만들어줘.
```

```text
svg-infographic으로 이 before/after 마이그레이션 설명을 구조적인 소셜 인포그래픽으로 바꿔줘.
```

```text
svg-infographic으로 이 4단계 프로세스를 한국어 한 장짜리 인포그래픽으로 그려줘. 4:5 소셜 비율로.
```

## 출력 artifact

- `*.svg` — 편집 가능한 source of truth
- `*.png` — 공유·슬라이드·소셜 포스트용 2x export

파일을 쓰기 전에 skill은 현재 프로젝트 안의 출력 디렉터리를 제안하고 사용자 확인을 받는다.

## 기본 스타일

- 스타일: muted technical
- 폰트 스택: Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif
- 테마: light background
- 컬러 시스템: 한 곳에 모은 CSS variables

생성 전에 brand color, 비율, 언어, 다크 모드, 출력 형식을 바꿀 수 있다.

## 한계

- PNG export는 browser-based rendering에 의존한다. 사용할 수 없는 환경에서는 SVG만 전달하고 그 한계를 명시한다.
- 출력은 벡터/구조 기반이다. 래스터 일러스트, 사진, 손그림 질감은 만들지 않는다.

## 예제

[`examples/`](../../examples) 참고. 공개 예제는 release-gated다.
