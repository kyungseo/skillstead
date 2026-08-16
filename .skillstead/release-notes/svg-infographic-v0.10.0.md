> **Latest** refers to the most recently published individual skill release, not a catalog version.

## svg-infographic 0.10.0

This minor release rebuilds the skill around nine generated TypePacks and their verification receipts. Requests
route by content signal into a bounded type contract, and canonical Korean and English artifacts can be rebuilt and
checked against the package surface that produced them. The catalog is a representative core set, not an exhaustive
list of every diagram the skill may support.

Architecture topology now uses semantic node and edge kinds rather than choosing meaning from an icon name. A shared
icon registry rejects unknown identifiers instead of silently substituting another symbol. Compact and regular node
variants carry explicit port, clearance, padding and system-boundary contracts, including event edges from a queue to
a worker.

The live gallery localizes its page copy, Featured metadata, selection signals, details, alt text and document
language while keeping language choice independent from side-by-side artifact viewing. Provenance canonicalization
v2 treats only the package version scalar as release bookkeeping; other runtime guidance remains byte-sensitive.

### 한국어

이번 minor release는 스킬을 아홉 가지 TypePack과 검증 receipt 중심으로 재구성했습니다. 요청의 내용 신호에
따라 범위가 정해진 타입 계약을 선택하며, canonical 한국어·영어 artifact를 생성 당시의 패키지 surface와
대조해 다시 만들고 검증할 수 있습니다. 이 카탈로그는 대표적인 core type을 담으며 가능한 모든 다이어그램을
나열한 exhaustive catalog는 아닙니다.

아키텍처 토폴로지는 이제 icon 이름이 아니라 의미를 나타내는 node·edge kind를 사용합니다. 공용 icon registry에
없는 identifier는 다른 아이콘으로 조용히 대체하지 않고 거부합니다. compact·regular node variant에는 port,
clearance, padding과 system boundary 계약이 있으며, queue에서 worker로 이어지는 event edge도 구분합니다.

live gallery는 page copy, Featured metadata, selection signal, 상세 정보, alt text와 문서 언어를 함께 전환합니다.
언어 선택과 artifact 나란히 보기는 서로 독립적입니다. provenance canonicalization v2는 패키지 version scalar만
릴리스 bookkeeping으로 다루며, 그 밖의 runtime guidance는 계속 byte-sensitive하게 검증합니다.

## Evidence And Limits

- Package: `skills/svg-infographic/`
- Tag: `svg-infographic/v0.10.0`
- Validation: the release candidate must pass the package suite, repository suite, exact canonical artifact ledger,
  clean-source receipt gate and public gallery verification before publication
- Compatibility or migration: existing hand-authored SVGs remain valid; newly generated canonical artifacts use
  provenance canonicalization v2 and package surface revision 17
- Known limitations: the nine TypePacks are representative core types rather than an exhaustive catalog; Linux
  browser rendering remains unverified

The versioned unit is the package above. GitHub's source archive is a snapshot of the whole repository at the
tagged commit; it is not a standalone package artifact.
