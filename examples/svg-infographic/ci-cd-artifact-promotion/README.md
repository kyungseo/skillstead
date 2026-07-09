<!-- 한국어는 아래 -->

# Example: Release Candidate Artifact Promotion

A three-band technical diagram of a build-once / promote-the-same-digest release
model, produced by `svg-infographic`, in English and Korean. One CI build
produces a release-candidate artifact identified by its image digest; the **same
digest** is promoted through dev → test → prod behind an approval gate; a bug
found in test produces a **new** release candidate rather than a rebuild of the
same one. A footer states the operating rules (deploy by digest, rollback by
redeploy, tag as a record).

| English | 한국어 |
| --- | --- |
| ![Release candidate artifact promotion (EN)](./ci-cd-artifact-promotion.en.png) | ![릴리스 후보 아티팩트 승격 (KO)](./ci-cd-artifact-promotion.ko.png) |

## Output files

| File | Role |
| --- | --- |
| `ci-cd-artifact-promotion.en.svg` | English source (editable) |
| `ci-cd-artifact-promotion.en.png` | English 2× export (1520×940) |
| `ci-cd-artifact-promotion.ko.svg` | Korean source (editable) |
| `ci-cd-artifact-promotion.ko.png` | Korean 2× export (1520×940) |

SVG is the editable source of truth; PNG is the 2× export (exactly twice the SVG
`viewBox`) for slides, docs, and social.

## Provenance

Sample content is synthetic. Names, identifiers, digests, tools, and environments
are placeholders; no customer or confidential identifiers are included.
(샘플 내용은 합성 예제입니다. 이름, 식별자, digest, 도구, 환경은 placeholder이며
고객·기밀 식별자는 포함하지 않습니다.)

## Prompt (English)

```text
Use svg-infographic to make a clean flat technical infographic titled "Release
Candidate Artifact Promotion". Three labelled bands: (1) BUILD — Source → CI Build
(once) → RC-01 artifact with a placeholder digest image@sha256:aaa111…; (2)
PROMOTE — dev → test → prod, all pinned to @aaa111, with an "approval gate" pill
on the test→prod arrow and a note that test == prod (identical digest); (3)
RELEASE FIX — a bug in test drops RC-01 and a fix produces a new RC-02 with a
different digest @sha256:bbb222…. Add a footer with three rules: deploy by digest
not tag, rollback = redeploy a previously approved digest, tag after a successful
prod deploy. Icon-first cards, semantic colors. Export SVG + 2× PNG.
```

---

# 예제: 릴리스 후보 아티팩트 승격

빌드는 한 번만 하고 **동일한 image digest**를 그대로 승격하는 릴리스 모델을 3개 밴드로
그린 예제다. `svg-infographic`으로 영문·한글 두 본을 만들었다. CI 빌드 1회가 digest로
식별되는 릴리스 후보 아티팩트를 만들고, 그 동일 digest가 승인 게이트를 거쳐 dev → test →
prod로 승격된다. test에서 버그가 나면 같은 후보를 재빌드하지 않고 **새 릴리스 후보**를
만든다. 하단 footer는 운영 규칙(digest로 배포, 재배포로 롤백, 태그는 기록)을 정리한다.

## 프롬프트 (한국어)

```text
svg-infographic으로 "릴리스 후보 아티팩트 승격" 제목의 깔끔한 flat technical 인포그래픽을
만들어줘. 라벨이 붙은 밴드 3개: (1) BUILD — 소스 → CI 빌드(1회) → placeholder digest
image@sha256:aaa111…를 가진 RC-01 아티팩트; (2) PROMOTE — dev → test → prod를 모두
@aaa111에 고정하고, test→prod 화살표에 "승인 게이트" pill, test == prod(동일 digest) 주석;
(3) RELEASE FIX — test 버그로 RC-01을 폐기하고 수정본이 다른 digest @sha256:bbb222…의
새 RC-02를 만든다. 하단 footer에 규칙 3개: tag가 아니라 digest로 배포, 롤백 = 이전에 승인된
digest 재배포, prod 배포 성공 후 태그. icon-first 카드, 의미 색상. SVG + 2x PNG로 export.
```
