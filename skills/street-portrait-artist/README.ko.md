# street-portrait-artist

[English](./README.md) · **한국어**

`Street Artist`는 한 장 이상의 인물 사진에서 눈에 보이는 특징 관계를 먼저 분석한 뒤, 그 사람임을 알아볼 수 있는
캐릭터 초상화로 재해석합니다. 단순한 style filter가 아닙니다. 하나의 `Impression Map`을 공유하는 두 가지 해석으로
“한 얼굴, 두 개의 진실”을 만듭니다.

## 차별점

일반적인 portrait filter가 한꺼번에 처리하기 쉬운 네 가지 판단을 분리합니다.

1. `Reference Triangulation`: 한 사진이 pose와 crop을 소유하고, 추가 사진은 얼굴을 평균 내거나 pose를 섞지 않은 채
   이름 붙인 identity feature만 보완합니다.
2. `Impression Map`: head frame, T-axis, mouth-chin rhythm, outer anchor, expression과 하나의 primary anchor를 기록합니다.
3. `Action-Reaction Distortion`: 한 특징만 따로 키우지 않고, 과장에 맞춰 주변 관계도 일관되게 반응시킵니다.
4. `Artist's Note`: 성격을 추론하지 않고 핵심 시각 아이디어와 그에 따른 구조 선택을 설명합니다.

사용 가능한 사진이 한 장이면 `Quick Sketch`, 서로 보완하는 사진이 두세 장이면 `Studio Portrait`를 선택합니다.

## 두 가지 Mode

| Mode | 해석 | 대표적인 마감 |
| --- | --- | --- |
| `Street Caricature` / `Exaggerate` | 재치 있고 다정한 구조 아이디어 하나를 찾아 관계 전체에 일관되게 적용 | 따뜻한 drawing paper, 종이를 살린 얼굴 면, 거의 무채색인 ink·graphite, 과감한 검정 면과 극소량의 차분한 point color |
| `Romance Watercolor` / `Illuminate` | 같은 identity를 서정적으로 단순화하고 절제된 character idealization으로 드러냄 | cold-pressed paper, 굵기가 달라지는 정밀한 pen contour, 투명 wash, 묶어서 표현한 머리카락·의상, 부드럽게 남긴 환경 |

두 mode는 하나의 identity grammar를 공유합니다. `Twin Portrait`는 같은 Impression Map에서 두 작품을 따로 만들며,
두 번째 이미지가 첫 번째 결과에 맞춰 인물을 새로 정의하면 안 됩니다.

## 시작하기

본인이 소유했거나 초상 사용 권한이 있는 선명한 사진을 제공하고 mode 또는 원하는 결과를 설명합니다. mode를
지정하지 않으면 `Street Caricature`를 기본값으로 사용한다고 먼저 밝힙니다.

```text
Use street-portrait-artist on these two photos of me. Treat the first as the composition anchor and the second only as
hairline and jaw clarification. Make a kind Street Caricature for a 4:5 social post, and tell me the one visual idea you
used. Do not add text or a signature.
```

설치한 skill이 발견되는 Codex에서는 `$street-portrait-artist`를 사용합니다. 이번 release에서는 ChatGPT의 설치 방법이나
호출 syntax를 주장하지 않습니다. 제품에 image 기능이 있다는 사실만으로 package 지원이 입증되지는 않습니다. fresh
install·discovery·invocation·reference-image·fallback·output-delivery evidence가 승인될 때까지 ChatGPT와 Codex는 모두
`Validation pending`입니다.

## Social Output

기본 `social-feed-portrait`는 `4:5` 구도이며, 현재 surface가 생성하고 검증할 수 있을 때 exact
`1080 x 1350 px` PNG를 목표로 합니다. 요청한 경우 `social-square` (`1080 x 1080 px`)와 `story-vertical`
(`1080 x 1920 px`)을 사용할 수 있습니다. 이미지를 늘이거나 크기를 지어내지 않고 실제 치수를 알리며, exact export가
불가능하면 그 사실을 명시합니다.

## 경계

graffiti, mural, 복원, 채색, face swap, 미화, 연령 변환, photorealistic retouching 또는 likeness reference가 없는
가상 인물에는 사용하지 않습니다. 외모에서 성격·민족성·건강·매력도처럼 민감하거나 확인할 수 없는 특성을 추론하지
않습니다. 특정 생존 작가·studio·brand·기존 작품을 모방하지 않습니다.

텍스트가 많은 poster나 infographic에서는 이 skill이 portrait layer만 만들 수 있으며, layout·typography·file
placement·publication은 host artifact workflow가 소유합니다. 제공한 사진·Impression Map·결과물은 해당 작업에만
사용하며, 별도 허가 없이 public example이나 영구적인 character profile로 재사용하지 않습니다.

얼굴 유사성, deterministic regeneration, 제품 간 동일한 결과, 사람의 직접 창작 또는 현재 surface가 생성·검증할 수
없는 exact export를 보장하지 않습니다.

## Package

`skills/street-portrait-artist/` folder 전체를 설치합니다. 필요한 mode reference와 license가 package 안에 있으며,
repository-only scenario와 answer key는 folder 설치본에서 제외합니다.

Version `0.1.0`은 첫 Experimental release입니다. 공개 가능한 합성 gallery는 의도한 visual direction을 보여 주지만
runtime 지원을 입증하지 않습니다. ChatGPT와 Codex 지원은 공개된 package를 각 제품에 설치하고 평가할 때까지
`Validation pending`으로 유지합니다.
