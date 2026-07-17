# Social Release Note Template

repo를 public으로 전환한 뒤 공개 공유 문구를 준비할 때 사용한다.

social note는 대상 repo에 꼭 남길 필요가 없다. 이 playbook, private notes repo,
또는 local draft로 보관하다가 문구가 준비되면 게시한다.

## 입력값

- Repository:
- Public URL:
- 한 문장 설명:
- 주요 대상:
- 만든 이유:
- 지금 준비된 것:
- 아직 의도적으로 미완성인 것:
- Screenshot / gallery / demo asset:
- 게시 채널:

## 메시지 체크리스트

- [ ] 무엇을 공개했는지 구체적으로 시작한다.
- [ ] 어떤 문제를 해결하는지 말한다.
- [ ] 가장 유용한 artifact나 example을 언급한다.
- [ ] AI 관련 과장 표현을 피한다.
- [ ] 필요하면 limitation 또는 early-stage 상태를 솔직하게 말한다.
- [ ] public repo 링크를 포함한다.
- [ ] 시각 자료가 중요한 프로젝트면 image/demo asset을 함께 쓴다.

## 한국어 초안

```text
{project_name}을 공개했습니다.

{one_sentence_description}

이런 상황에서 유용합니다: {job_to_be_done}

현재 repo에는 {key_artifact_1}, {key_artifact_2}, {key_artifact_3}가 포함되어 있습니다.

아직 {limitation}은 남아 있지만, 핵심 흐름인 {core_workflow}는 사용할 수 있는 상태입니다.

{repo_url}
```

## 짧은 영문 초안

영문 채널에 공유할 때만 사용한다.

```text
I made {project_name} public: {one_sentence_description}

It is useful for {audience} who need {job_to_be_done}.

The repo includes {key_artifact_1}, {key_artifact_2}, and {key_artifact_3}.

Still early, but the core path is ready: {core_workflow}.

{repo_url}
```

## 리뷰 질문

- [ ] 낯선 사람이 프로젝트가 무엇을 하는지 이해할 수 있는가?
- [ ] 공개 문구가 README와 일치하는가?
- [ ] 이미지나 asset이 실제 프로젝트를 보여주는가?
- [ ] limitation이 사과가 아니라 정직한 맥락으로 보이는가?
- [ ] 링크가 public이고 접근 가능한가?

