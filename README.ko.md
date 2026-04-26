# AhahahaIDE

[![CI](https://github.com/ramenshin/AhahahaIDE/actions/workflows/ci.yml/badge.svg)](https://github.com/ramenshin/AhahahaIDE/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)](#지원-플랫폼)
[![Status](https://img.shields.io/badge/status-alpha-orange)](.)

여러 프로젝트에서 [Claude Code](https://docs.claude.com/en/docs/claude-code) 작업 흐름을 함께 다루기 위한 개인용 IDE. **Windows 전용.**

> 🇬🇧 [English README](README.md)

AhahahaIDE는 Claude CLI와 PowerShell 세션을 하나의 Electron 기반 IDE로 묶어줍니다: 파일 트리, Monaco 에디터, 프로젝트 메모, 멀티 프로젝트 탭, 퍼지 파일·내용 검색(QuikSearch), 그리고 에디터·Claude 세션 전체를 한 번에 저장하는 "상태저장" 기능.

## 스크린샷

<p align="center"><img src="docs/screenshots/AhahahaIDE_screenshot.png" width="900" alt="AhahahaIDE 메인 화면" /></p>

---

## 지원 플랫폼

**Windows 10 / 11 전용.** macOS, Linux는 **지원하지 않습니다** — 다른 OS에서는 앱 실행 자체가 차단됩니다.

크로스 플랫폼 지원은 커뮤니티 기여(PR)는 환영하지만 작성자가 직접 유지보수하지는 않습니다. [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

## 주요 기능

- 🔀 **멀티 프로젝트 탭** — 여러 프로젝트를 동시에 열고, 각각 독립된 Claude + PowerShell PTY 세션
- 📝 **Monaco 에디터** — 약 30개 언어 문법 강조, Ctrl+S 저장, 미저장 표시
- 📓 **프로젝트별 메모** — `user_defined_memo.md` 자동 로드/저장
- 🔍 **QuikSearch** — `Ctrl+P` 파일명 퍼지 검색, `Ctrl+Shift+F` 내용 검색 (`.txt` / `.md` / `.pdf` 문서, 약 35개 코드 확장자)
- 💾 **상태 저장** — 에디터 미저장 내용 즉시 flush + Claude 세션에 작업 정리 지시(현재 프로젝트만 또는 열린 모든 프로젝트)
- 🎨 **테마 8개**, **레이아웃 3종** (가로 3단 / 세로 3열 / 에디터 위·터미널 2열), 줌 (80~150%)
- ⚙️ **설정 UI** — 루트 폴더, 제외 패턴, 최대 세션 수, 레이아웃, 테마

## 요구 사항

### 실행
- **Windows 10 / 11** (다른 OS 미지원)
- **[Claude CLI](https://docs.claude.com/en/docs/claude-code/quickstart)** 설치 및 인증 완료 (`claude` 명령이 `PATH`에 있어야 하며, 한 번 `claude login` 실행 필요)
- **PowerShell 5.1+** (Windows 10 / 11 기본 포함)

### 개발
- **Node.js 20+**
- **npm 10+**

## 설치

### Releases에서 (권장)

1. [Releases](https://github.com/ramenshin/AhahahaIDE/releases) 페이지에서 `AhahahaIDE-Setup-x.y.z.exe` 다운로드
2. 설치 실행. 코드 사이닝이 안 되어 있어 Windows SmartScreen 경고("PC를 보호했습니다")가 뜰 수 있습니다 — **추가 정보 → 실행** 클릭
3. 시작 메뉴에서 실행

### 소스에서

```bash
git clone https://github.com/ramenshin/AhahahaIDE.git
cd AhahahaIDE
npm install
npm run dev
```

## 빠른 시작

처음 실행 시 AhahahaIDE가 **프로젝트 루트 폴더**를 묻습니다 (예: `C:\Users\사용자\Projects`). 그 폴더 바로 아래의 모든 폴더가 프로젝트로 인식됩니다.

1. **왼쪽 트리에서 프로젝트 클릭** — 탭이 열리고 Claude + PowerShell 세션이 시작됨
2. **파일 탐색기에서 파일 클릭** — Monaco 에디터에서 열림
3. **`Ctrl+P`** — 모든 프로젝트의 파일명을 퍼지 매칭으로 검색
4. **`Ctrl+Shift+F`** — 문서 내용 검색
5. **⚙ 설정** — 테마, 루트 경로, 최대 세션 수, 레이아웃 등 변경

## 아키텍처

| 레이어 | 기술 | 비고 |
|---|---|---|
| Main | Electron + Node.js | PTY (`node-pty`), 파일 시스템, IPC, 설정 저장 |
| Preload | Context bridge | 렌더러에 `window.api.*` 노출 |
| Renderer | React + Vite | Monaco, xterm.js, react-resizable-panels |

설정 파일은 기본적으로 `%APPDATA%\AhahahaIDE\config.json`에 저장됩니다. `AHAHAHAIDE_CONFIG_DIR` 환경변수로 다른 경로 지정 가능.

## 개발

```bash
npm run dev          # 핫 리로드 dev 서버
npm run typecheck    # TypeScript 검사 (main + renderer)
npm run dist         # NSIS 설치 파일 빌드 (Windows 전용)
```

코드 스타일·커밋 컨벤션·PR 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md) 참고.

## 프로젝트 상태

AhahahaIDE는 **개인 프로젝트**로, 작성자가 여가 시간에 유지보수합니다. 이슈·PR 응답 시간은 일정하지 않을 수 있습니다. 버그 신고와 풀 리퀘스트 환영 — [Issues](https://github.com/ramenshin/AhahahaIDE/issues).

**알파 품질** 소프트웨어입니다. 중요한 작업은 별도 백업을 권장합니다.

## 사용한 오픈소스

- [Anthropic Claude](https://www.anthropic.com/) — 이 IDE가 감싸는 Claude CLI
- [Electron](https://www.electronjs.org/) — 데스크탑 런타임
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — 코드 편집
- [xterm.js](https://xtermjs.org/) — 터미널 렌더링
- [node-pty](https://github.com/microsoft/node-pty) — Pseudo-terminal
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) — QuikSearch의 PDF 텍스트 추출

## 라이선스

AhahahaIDE는 **[GNU General Public License v3.0 or later](LICENSE)** 로 배포됩니다.

이 라이선스는 copyleft 라이선스로, 본 소프트웨어를 자유롭게 사용·수정·재배포할
수 있지만, **재배포되는 파생 저작물 또한 GPL-3.0(이후 버전 포함) 라이선스로
공개**되어야 합니다. 전체 조건은 [LICENSE](LICENSE) 파일 참고.

Copyright © 2026 ramenshin
