# Codex Compose Fresh-Context Raw Outputs — 2026-07-18

Each scenario ran in a separate context with no inherited conversation turns. Evaluators could read only the
installed skill folder and received one complete scenario inline. Examples and the answer key were unavailable.
Model and reasoning effort were not exposed by the runtime.

## F16 — First Run, Pre-Fix

## Drafted Text

# Acme Queue Lens

Acme Queue Lens inspects a local queue snapshot and generates a local HTML report. The command does not upload the snapshot or the generated report.

## Quick start

Run the inspector against your snapshot:

```sh
acme-queue inspect snapshot.json
```

A successful run creates `report.html`. Open that file in your browser to view the report.

## Platform support

Acme Queue Lens is verified on macOS 15. Windows and Linux have not been verified.

## Source Notes

- Preserved the product name, command, and output path exactly.
- Described only the supplied capability: inspecting a local queue snapshot and creating a local HTML report.
- Kept the no-upload boundary explicit for both the snapshot and report.
- Presented macOS 15 as verified and Windows/Linux as unverified.

## Assumptions And Omissions

- Assumed the CLI is already available; installation instructions were omitted because none were supplied.
- Omitted snapshot-format requirements, prerequisites, and broader compatibility claims because they were not provided.

Driver judgment: fail. The sentence “Open that file in your browser” turns the supplied artifact format into an
unsupplied product procedure.

## F16 — Post-Fix Run

## Drafted Text

# Acme Queue Lens

Acme Queue Lens is a command-line tool that inspects a local queue snapshot and creates a local HTML report. The command does not upload the snapshot or the report.

## Quick start

```sh
acme-queue inspect snapshot.json
```

The report is written to:

```text
report.html
```

## Platform support

- Verified: macOS 15
- Unverified: Windows and Linux

## Source Notes

The draft preserves the supplied product name, command, output path, local-only boundary, and platform verification status exactly.

## Assumptions And Omissions

The quick start assumes that Acme Queue Lens is already installed and `snapshot.json` is available to the command. Installation steps and snapshot-generation instructions were omitted because they were not supplied.

## F17 — First Run

## 작성 문안

### Acme Vault 시작하기

Acme Vault는 macOS 15에서 검증되었습니다. Windows와 Linux 환경은 아직 검증되지 않았습니다.

1. Acme Vault를 설치합니다.

   ```bash
   brew install acme-vault
   ```

2. `~/Documents`를 초기화합니다.

   ```bash
   acme-vault init ~/Documents
   ```

   초기화가 완료되면 `.acme-vault/config.yml` 파일이 생성됩니다.

초기화만으로는 데이터가 업로드되지 않습니다. 사용자가 `acme-vault push`를 실행하기 전까지 업로드는 이루어지지 않습니다.

## 출처 메모

- 설치 및 초기화 명령, 생성되는 설정 파일 경로를 제공된 사실 그대로 사용했습니다.
- 데이터 업로드 시점을 `acme-vault push` 실행 전후의 경계로 명확히 표현했습니다.
- 검증된 플랫폼은 macOS 15로 한정하고, Windows와 Linux는 미검증 상태로 유지했습니다.

## 가정 및 생략

- 이 문안의 완료 범위는 설치와 `~/Documents` 초기화까지로 보았습니다.
- 제공되지 않은 사전 요구 사항, 오류 해결 절차, `push`의 세부 동작은 추가하지 않았습니다.

## F18 — First Run

## Drafted Text

**Provisional draft — not ready for publication**

# Acme Tasks 3.0

Acme Tasks 3.0 changes synchronization behavior.

[Describe what existing users will notice and who is affected.]

[State whether users need to take any action before or after updating.]

[Add verified compatibility and QA results for macOS 15, Windows, and Linux.]

## Source Notes

- Version: Acme Tasks 3.0.
- Confirmed change: synchronization behavior changed.
- Internal identifier: `SYNC-220`.
- QA ran on macOS 15, but no result was supplied.
- No evidence was supplied for user-visible effects, migration requirements, or Windows/Linux status.

## Needs Human

The note cannot be published safely until these questions are answered:

- What exactly changes from an existing user’s perspective?
- Which users or synchronization scenarios are affected?
- Is any migration, reconfiguration, sign-in, resynchronization, or other user action required?
- Did QA on macOS 15 pass or fail, and what synchronization scenarios did it cover?
- What is the tested or supported status on Windows and Linux?

## Assumptions And Omissions

- The draft assumes a concise English release note for existing users.
- `SYNC-220` is omitted from the public text because it is an internal ticket and does not help users act.
- The macOS 15 QA activity is omitted because running QA does not establish a successful result.
- No benefits, fixes, reliability improvements, compatibility claims, or upgrade guidance were invented.
- The placeholders are intentionally explicit: the supplied evidence supports only the version and the existence of a synchronization change, not a publishable release note.
