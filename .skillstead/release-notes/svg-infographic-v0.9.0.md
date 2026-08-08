> **Latest** refers to the most recently published individual skill release, not a catalog version.

## svg-infographic 0.9.0

This minor release catches recurring vertical-layout drift in the editable SVG source before rendering. Authors
can opt page titles, panel headers, and icon-text cards into explicit layout contracts. The source lint then checks
that a one-line or two-line title rail follows the actual title stack, panel text clears its divider, and card
frames, icons, and complete text clusters use the same vertical center.

Existing SVGs are unaffected unless they use the new `data-layout-role` annotations. Geometry that can be proved
from source produces deterministic errors when it violates the declared budget. Unsupported units, transforms,
or typography remain warnings that require review in the final 2× PNG; the source model does not claim to measure
rendered glyph ink or optical centering.

### 한국어

이번 minor release는 반복적으로 발생하던 세로 배치 오류를 렌더링 전에 편집 가능한 SVG 원본에서
찾도록 개선했습니다. Page title, panel header와 icon-text card에 명시적인 layout contract를 적용하면,
source lint가 한 줄·두 줄 제목의 rail이 실제 title stack을 따라가는지, panel text와 divider 사이에
필요한 여백이 있는지, card frame·icon·전체 text cluster가 같은 세로 중심을 사용하는지 검사합니다.

새 `data-layout-role` annotation을 사용하지 않는 기존 SVG에는 영향을 주지 않습니다. 원본에서 확정할 수
있는 배치가 선언한 범위를 벗어나면 명확한 error를 보고합니다. 단위, transform 또는 typography 때문에
원본만으로 판단할 수 없는 경우에는 warning을 남기며, 최종 2× PNG에서 직접 확인해야 합니다. 이 검사는
렌더링된 글자의 실제 영역이나 시각적 중심까지 측정한다고 주장하지 않습니다.

## Evidence And Limits

- Package: `skills/svg-infographic/`
- Tag: `svg-infographic/v0.9.0`
- Validation: source lint `52/52`, renderer regression `19/19`, repository tests `178/178`, repository validator
  `0 finding(s)`, and the generic skill validator reported `Skill is valid!`
- Compatibility or migration: no migration is required; the new layout contracts are opt-in
- Known limitations: source-coordinate checks do not replace rendered-ink and optical-alignment review in the
  final 2× PNG

The versioned unit is the package above. GitHub's source archive is a snapshot of the whole repository at the
tagged commit; it is not a standalone package artifact.
