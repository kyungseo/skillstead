> **Latest** refers to the most recently published individual skill release, not a catalog version.

## svg-infographic 0.11.0

This minor release adds an optional way to present a verified infographic in context. Ask for a notebook, gallery
wall, or portrait monitor and the skill creates a separate presentation PNG after the editable SVG and exact
canonical 2× PNG have passed their usual checks. If projection is not requested, the ordinary output is unchanged.
If projection fails, the accepted canonical result remains valid.

The starter set includes paper notebook, gallery wall, and portrait monitor. Paper notebook is used when a
projection request does not name a surface; an explicit choice always wins. A short signature can be placed in
the registered lower-right slot or omitted. Users can also provide their own local raster background through a
strict manifest instead of changing the bundled templates.

Each projection is bound to the verified canonical pair, registered surface, geometry, blend profile, signature
state, and output digest in a separate receipt. The compositor allows only bounded rect or quad placement and
fixed print/display treatments—no free-form filtering or neural restyling. The notebook placement is calibrated
to follow the page's upper edge so the content does not appear to sag toward the right.

### 한국어

이번 minor release에는 검증된 인포그래픽을 맥락 있는 배경에 보여 주는 선택형 presentation projection이
추가되었습니다. 노트, 갤러리 벽 또는 세로형 모니터를 요청하면 편집 가능한 SVG와 exact canonical 2× PNG가
기존 검사를 통과한 뒤 별도의 presentation PNG를 만듭니다. Projection을 요청하지 않으면 기존 출력은 달라지지
않으며, projection에 실패해도 이미 승인된 canonical 결과는 계속 유효합니다.

기본 템플릿은 paper notebook, gallery wall, portrait monitor 세 가지입니다. Projection을 요청하면서 surface를
고르지 않으면 paper notebook을 사용하고, 사용자가 surface를 지정하면 그 선택이 항상 우선합니다. 등록된 우측
하단 영역에는 짧은 서명을 넣거나 비워 둘 수 있습니다. 기본 템플릿 대신 strict manifest로 등록한 사용자의 local
raster 배경을 사용할 수도 있습니다.

각 projection은 검증된 canonical pair, 등록된 surface, geometry, blend profile, signature 상태와 output digest를
별도 receipt로 결속합니다. Compositor는 범위가 제한된 rect·quad 배치와 고정된 print/display 처리만 허용하며,
자유형 filter나 neural restyle은 적용하지 않습니다. Paper notebook은 페이지 상단선과 자연스럽게 맞도록 보정해
콘텐츠가 오른쪽으로 처져 보이지 않게 했습니다.

## Evidence And Limits

- Package: `skills/svg-infographic/`
- Tag: `svg-infographic/v0.11.0`
- Validation: the release candidate must pass version and release-record checks, unchanged runtime/verification
  digest checks, hosted pull-request CI, selected projection receipt verification, and post-release pinned-install
  smoke before publication is complete
- Compatibility or migration: no migration is required; without an explicit projection request, the editable SVG
  and exact canonical 2× PNG remain the only ordinary outputs
- Known limitations: the bundled set contains three surfaces; V1 custom surfaces are local raster PNGs with strict
  manifests, not remote URLs, arbitrary SVG/HTML, or active content. Byte-identical projection regeneration is a
  same-environment claim; cross-environment checks verify receipt-bound invariants instead

The versioned unit is the package above. GitHub's source archive is a snapshot of the whole repository at the
tagged commit; it is not a standalone package artifact.
