# Open Shell Toolbar for VSCode

[![Build & Release](https://github.com/neo-idea/open-shell-toolbar-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/neo-idea/open-shell-toolbar-vscode/actions/workflows/release.yml)
[![Latest Release](https://img.shields.io/github/v/release/neo-idea/open-shell-toolbar-vscode)](https://github.com/neo-idea/open-shell-toolbar-vscode/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**One-click shell commands, right in your status bar.**

Open Shell Toolbar pins your frequently-used shell commands onto the VSCode
status bar and the Explorer sidebar — stop retyping `pnpm dev`,
`docker compose up`, or `git pull --rebase` in a terminal. Click, done.

This is the VSCode sibling of the IntelliJ plugin
[open-shell-toolbar-plugin](https://github.com/neo-idea/open-shell-toolbar-plugin),
with the same ideas: terminal-first execution, two display modes, and live
configuration.

## ✨ Features

- **Status bar buttons for shell commands** — every pinned command is a
  one-click button (flat mode, default)
- **Popup mode** — a single status bar button that opens a quick-pick menu
  with all commands (switch via `Open Shell: Set Display Mode`)
- **Runs in the integrated terminal** — each command gets its own reused
  terminal tab; variables like `${workspaceFolder}`, `${userHome}`,
  `${env:NAME}`, `$HOME` are substituted before execution
- **Sidebar manager** — Explorer → *Shell Commands*: click to run,
  right-click to edit / duplicate / enable / delete
- **Icons** — emoji (🚀) or built-in
  [codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html)
  ids like `$(play)`
- **Import / export** commands as JSON
- **Live refresh** — every change applies immediately, no reload
- **Persistent** — commands are stored globally and survive restarts

## 📦 Installation

1. Download the latest `open-shell-toolbar-*.vsix` from
   [Releases](https://github.com/neo-idea/open-shell-toolbar-vscode/releases)
2. In VSCode: **Extensions → ⋯ → Install from VSIX…**
3. Reload when prompted

## 🚀 Quick Start

After installing (or run **Help → Welcome → Walkthroughs** for the built-in
*Open Shell Toolbar — Get Started* guide):

1. Command Palette (`⌘⇧P`) → **Open Shell: Add Command**
2. Fill in:

   | Field | Example |
   |---|---|
   | Title | `Dev Server` |
   | Command | `pnpm dev` |
   | Working Directory | *(empty = workspace folder)* |
   | Icon | 🚀 or `$(play)` |
   | Terminal | Yes |

3. A **▶ Dev Server** button is now on your status bar — click to run.

## 📖 Where to find everything

| Entry point | Where | What it does |
|---|---|---|
| **Status bar** | Bottom-left of the window | Flat mode: one button per command; popup mode: one `$(terminal) Commands` button. No commands yet → `Shell +` button adds one |
| **Activity Bar** | Left edge, terminal icon → *Shell Commands* | Manage: run, edit, duplicate, disable, delete |
| **Command Palette** | `⌘⇧P` → type "Open Shell" | Add / run / display mode / import / export |
| **Walkthrough** | Welcome page → Walkthroughs | Step-by-step getting-started guide |

## 🛠 Development

```bash
npm install
npm run compile   # TypeScript → out/
npm test          # unit tests (node:test)
npm run package   # produce .vsix via vsce
```

Press `F5` in VSCode to launch an **Extension Development Host** with the
extension loaded.

CI builds and publishes a release with the packaged `.vsix` on every `v*` tag.

Contributions welcome — PRs and issues alike.

## 📄 License

[MIT](LICENSE) © neo-idea
