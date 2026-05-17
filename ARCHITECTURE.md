# ReconMaster Architecture

## Overview

Electron desktop application with a React renderer and a Node.js main process.

```
┌──────────────────────────────────────────────────────────────────┐
│  Renderer Process (React + Zustand)                              │
│  src/renderer/                                                   │
│    App.tsx → scanStore / aiStore → components/                  │
│    Communicates via contextBridge (preload/index.ts)             │
└────────────────────┬─────────────────────────────────────────────┘
                     │ ipcRenderer.invoke / ipcRenderer.on
┌────────────────────▼─────────────────────────────────────────────┐
│  Main Process (Node.js)                                          │
│  src/main/                                                       │
│    index.ts         — app lifecycle, window, quit cleanup        │
│    ipc/router.ts    — registers all IPC handlers                 │
│    ipc/*.ts         — domain handlers (scan, agent, tools, …)   │
│    ipc/handle.ts    — error-catching wrapper around ipcMain      │
│    ipc/validate.ts  — Zod schemas for all IPC inputs            │
│    orchestrator.ts  — ScanOrchestrator (per-target scan engine) │
│    agentLoop.ts     — AI agent loop (tool calls + approvals)    │
│    agentTools.ts    — tool catalogue + scan plan builder        │
│    exploit/         — exploit plan builder + runner             │
│    providers/       — AI provider adapters (Anthropic, OpenAI…) │
│    lib/             — logger, auditLog, scopeValidator, …       │
└──────────────────────────────────────────────────────────────────┘
```

## IPC Flow

```
Renderer                   Main
  │                          │
  │─ invoke('scan:start') ──►│  scan.ts → validate → ScanOrchestrator.start()
  │                          │     │
  │◄─ on('scan:event') ──────│     └─ emit() per phase/log/result
  │                          │
  │─ invoke('agent:chat') ──►│  agent.ts → validate → runAgentLoop()
  │                          │     │
  │◄─ on('agent:chunk') ─────│     └─ streaming token + tool call events
  │◄─ on('agent:approvalRequired')  (confirm/silent/autonomous tiers)
```

## Security Model

| Layer | Mechanism |
|-------|-----------|
| IPC input validation | Zod schemas in `ipc/validate.ts` — validates all renderer input before processing |
| Scope enforcement | `assertExternalScope()` in `lib/scopeValidator.ts` — blocks RFC1918/loopback/link-local |
| Shell injection prevention | `CommandRunner` in `lib/commandRunner.ts` — always `shell:false`, custom parser |
| Secret storage | `lib/secureStorage.ts` — DPAPI/Keychain via `safeStorage` |
| Audit trail | `lib/auditLog.ts` — append-only `userData/audit.log` |
| Agent approval tiers | `confirm` tier always requires user confirmation, regardless of `autonomousMode` |
| File write scope | Agent outputs restricted to `userData/agent-output/` |

## Key Data Types

- `ScanResult` — full scan snapshot (renderer/types/index.ts)
- `ScanData` — main-process typed view of scan data (main/types/scan.ts)
- `WeaponizationItem` — weaponized finding (renderer/types/index.ts)
- `ProviderEntry` / `ProviderState` — AI provider config (main/types/provider.ts)
- `AgentMsg` — message history entry for agent loop (main/providers/index.ts)

## Storage Layout (userData/)

```
userData/
  audit.log              — security audit trail (append-only)
  app.log                — application log
  agent-settings.json    — agent autonomy config
  attacker-config.json   — lhost/lport/c2/cookie (sessionCookie encrypted)
  ai-providers.json      — provider entries (apiKey encrypted)
  tool-config.json       — enabled/disabled tool list
  binaries/              — downloaded tool binaries
  output/<scanId>/       — raw tool output per scan
  agent-output/          — agent-written files (scoped)
  exports/               — exported scan reports
  chats/<chatId>.json    — agent conversation history
  memories/<chatId>.json — agent persistent memory
```
