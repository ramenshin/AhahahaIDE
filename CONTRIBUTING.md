# Contributing to AhahahaIDE

Thanks for considering a contribution! This is a small personal project, so please read this short guide before opening issues or PRs.

## Project scope

AhahahaIDE is a **Windows-only personal IDE** for Claude Code workflows. The maintainer:
- Develops on Windows 10/11 with PowerShell
- Has limited time to review contributions
- May decline changes that don't fit the project's narrow focus

If you have a substantially different vision, you may have better luck forking and building it yourself.

## Reporting bugs

Open an issue with:
- **Windows version** (e.g., Windows 11 23H2)
- **AhahahaIDE version** (Settings or About)
- **Claude CLI version** (`claude --version`)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Logs** if available (DevTools console or main process console — exclude personal paths if needed)

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when opening an issue.

## Suggesting features

Open an issue describing:
- The problem you're trying to solve (not just the solution)
- Why this fits AhahahaIDE's scope
- Alternative approaches you considered

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

## Pull requests

### Before opening a PR

1. **Open or comment on an issue first** for non-trivial changes — saves wasted work if the maintainer disagrees with the direction
2. **Fork the repo** and create a topic branch
3. **Write code that compiles**: `npm run typecheck` must pass
4. **Verify the app starts** with `npm run dev` and basic features still work
5. **Keep the PR focused** — one logical change per PR

### Code style

- TypeScript strict mode — no `any` unless justified
- Functional React — hooks, no classes
- Comments only when the **why** is non-obvious; avoid restating what the code does
- Prefer Korean for user-facing UI strings (the app is Korean-first); English in code identifiers
- Match existing formatting (no separate Prettier config currently)

### Commit messages

Korean or English both fine. Format:
```
<area>: <짧은 요약 한 줄>

<선택 — 본문에 의도/이유 설명. 줄바꿈 70자 정도>
```

Examples:
- `pty-manager: handle SIGWINCH on resize`
- `Phase 8-E: QuikSearch — 파일명/문서/코드 3모드 검색`

### Cross-platform contributions

The project is officially **Windows-only**. macOS/Linux PRs are welcome but:
- The maintainer can't test them
- You should be willing to fix follow-up issues on your platform
- Add a clear note in the PR about which platforms you tested on

## Development setup

```bash
git clone https://github.com/ramenshin/AhahahaIDE.git
cd AhahahaIDE
npm install
npm run dev
```

Useful commands:
```bash
npm run typecheck    # TypeScript check (must pass before PR)
npm run dist         # Build NSIS installer
```

## Reviewing process

The maintainer will:
- Acknowledge PRs within ~1 week (no SLA — this is a side project)
- Leave inline comments for changes
- Either merge, request changes, or close with explanation

PRs may sit idle if the maintainer is busy. Please be patient or follow up after a week.

## License

By contributing, you agree that your contributions will be licensed under the
[GNU General Public License v3.0 or later](LICENSE), the same license as the
project itself. This is a copyleft license — derivative works distributed must
also be GPL-licensed.
