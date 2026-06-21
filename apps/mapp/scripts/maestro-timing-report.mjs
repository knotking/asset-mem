#!/usr/bin/env node
/**
 * Parse Maestro commands-*.json and print per-step timing (tap/assert/wait/screenshot).
 *
 * Usage:
 *   node scripts/maestro-timing-report.mjs [path-to-commands.json]
 *   node scripts/maestro-timing-report.mjs --latest
 *   node scripts/maestro-timing-report.mjs --latest audit-authenticated
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const maestroTestsDir = path.join(os.homedir(), '.maestro', 'tests');

function findLatestCommandsJson(flowHint) {
  if (!fs.existsSync(maestroTestsDir)) {
    throw new Error(`No Maestro tests dir at ${maestroTestsDir}`);
  }
  const runs = fs
    .readdirSync(maestroTestsDir)
    .filter((name) => fs.statSync(path.join(maestroTestsDir, name)).isDirectory())
    .sort()
    .reverse();

  for (const run of runs) {
    const dir = path.join(maestroTestsDir, run);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('commands-') && f.endsWith('.json'));
    const match = flowHint
      ? files.find((f) => f.includes(flowHint.replace(/\//g, '_')))
      : files[0];
    if (match) return path.join(dir, match);
  }
  throw new Error('No commands-*.json found under ~/.maestro/tests');
}

function resolveInputPath() {
  if (args[0] === '--latest') {
    return findLatestCommandsJson(args[1]);
  }
  if (args[0]) return path.resolve(args[0]);
  return findLatestCommandsJson();
}

function formatMs(ms) {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

function describeCommand(cmd) {
  if (!cmd || typeof cmd !== 'object') return null;

  if (cmd.tapOnElement) {
    const s = cmd.tapOnElement.selector ?? {};
    if (s.idRegex) return `tap id:${s.idRegex}${s.optional ? ' (opt)' : ''}`;
    if (s.textRegex) return `tap "${s.textRegex}"${s.optional ? ' (opt)' : ''}`;
    return 'tap';
  }
  if (cmd.tapOnPointV2Command) {
    return `tap point ${cmd.tapOnPointV2Command.point}${cmd.tapOnPointV2Command.optional ? ' (opt)' : ''}`;
  }
  if (cmd.assertConditionCommand) {
    const c = cmd.assertConditionCommand.condition?.visible;
    const label = c?.textRegex ?? c?.idRegex ?? 'element';
    const timeout = cmd.assertConditionCommand.timeout;
    return `wait/assert "${label}"${timeout ? ` ≤${timeout}ms` : ''}`;
  }
  if (cmd.takeScreenshotCommand) {
    return `screenshot ${cmd.takeScreenshotCommand.path}`;
  }
  if (cmd.launchAppCommand) return 'launchApp';
  if (cmd.inputTextCommand) return `input "${cmd.inputTextCommand.text}"`;
  if (cmd.runFlowCommand) {
    const src = cmd.runFlowCommand.sourceDescription;
    return src ? `▶ subflow ${src}` : '▶ subflow';
  }
  if (cmd.scrollUntilVisible) return 'scrollUntilVisible';
  if (cmd.waitForAnimationToEndCommand) {
    return `waitForAnimation ≤${cmd.waitForAnimationToEndCommand.timeout ?? '?'}ms`;
  }
  if (cmd.hideKeyboardCommand) return 'hideKeyboard';
  if (cmd.applyConfigurationCommand) return null;
  if (cmd.defineVariablesCommand) return null;

  const key = Object.keys(cmd)[0];
  return key ?? 'command';
}

/** Walk nested runFlow commands for detail lines (no duration — only leaf entries have timing). */
function innerSteps(cmd, indent = '    ') {
  const lines = [];
  if (!cmd?.runFlowCommand?.commands) return lines;
  for (const inner of cmd.runFlowCommand.commands) {
    const label = describeCommand(inner);
    if (label) lines.push(`${indent}${label}`);
    if (inner.runFlowCommand) lines.push(...innerSteps(inner, indent + '  '));
  }
  return lines;
}

function main() {
  const inputPath = resolveInputPath();
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const rows = [];
  for (const entry of raw) {
    const cmd = entry.command;
    const meta = entry.metadata ?? {};
    if (!cmd) continue;
    const label = describeCommand(cmd);
    if (!label) continue;
    rows.push({
      label,
      status: meta.status,
      duration: meta.duration,
      timestamp: meta.timestamp,
      inner: cmd.runFlowCommand ? innerSteps(cmd) : [],
    });
  }

  rows.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  const measured = rows.filter((r) => r.duration != null);
  const totalMs = measured.reduce((sum, r) => sum + (r.duration ?? 0), 0);
  const slow = measured.filter((r) => (r.duration ?? 0) >= 500);

  console.log(`\nMaestro timing report`);
  console.log(`Source: ${inputPath}`);
  console.log(`Steps: ${rows.length} (${measured.length} timed)`);
  console.log(`Total measured: ${formatMs(totalMs)}\n`);
  console.log('─'.repeat(72));
  console.log(`${'Duration'.padStart(10)}  ${'Status'.padEnd(10)}  Action`);
  console.log('─'.repeat(72));

  for (const row of rows) {
    const dur = formatMs(row.duration).padStart(10);
    const status = (row.status ?? '?').padEnd(10);
    const flag = (row.duration ?? 0) >= 1000 ? ' ⚠️ slow' : '';
    console.log(`${dur}  ${status}  ${row.label}${flag}`);
    for (const line of row.inner) {
      console.log(`${''.padStart(10)}  ${''.padEnd(10)}  ${line}`);
    }
  }

  if (slow.length) {
    console.log('\nSlow steps (≥500ms):');
    for (const row of slow.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))) {
      console.log(`  ${formatMs(row.duration).padStart(8)}  ${row.label}`);
    }
  }

  const outDir = path.dirname(inputPath);
  const reportPath = path.join(outDir, 'timing-report.txt');
  const lines = [
    `Source: ${inputPath}`,
    `Total: ${formatMs(totalMs)}`,
    '',
    ...rows.flatMap((r) => [
      `${formatMs(r.duration).padStart(10)}  ${(r.status ?? '?').padEnd(10)}  ${r.label}`,
      ...r.inner.map((l) => `${''.padStart(10)}  ${''.padEnd(10)}  ${l}`),
    ]),
  ];
  fs.writeFileSync(reportPath, lines.join('\n'));
  console.log(`\nWrote ${reportPath}\n`);
}

main();
