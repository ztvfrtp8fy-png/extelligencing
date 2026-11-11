// Command line interface. `main` is pure with respect to process state so tests can call it directly.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ExtelligencingError, parseArgs, now, isoDate, readText, sha256 } from './util.mjs';
import * as ob from './onboarding.mjs';
import * as ws from './workspace.mjs';
import * as ev from './evidence.mjs';
import * as inst from './install.mjs';
import { route, formatRoute, TASKS } from './context.mjs';
import { SUPPORTED, RUNTIME_STATUS } from './adapters.mjs';

const HELP = `extelligencing - Your intelligence, extended. (helper CLI)

Install
  init [--runtime kiro|codex|claude-code] [--target DIR] [--yes] [--trace]   Show the plan; --yes applies it
  uninstall [--target DIR] --yes [--purge-data]                     Remove Extelligencing files you did not change
  doctor                                                            Check the installation

Onboarding
  boot                                      Session-start check (prints nothing when there is nothing to say)
  onboarding status|resume|defer [--until D]|decline|reset --confirm
  onboarding block <id> <pending|done|skipped|deferred> [--until D]
  onboarding activate --json '<answers>' | --file answers.json

Context
  context route --task <${TASKS.join('|')}> [--topic WORDS] [--workspace NAME] [--conflicts] [--json]

Shared workspace (read-only)
  workspace connect <path> [--name NAME] | disconnect <name> | list | check [name] | read <name> <relpath>

Evidence (nothing persists without approval)
  evidence propose --json '<proposal>'
  evidence list [--status S] | show <id>
  evidence approve <id> --confirm | reject <id> [--reason R] | defer <id> [--until D]

Validation (live-runtime checks, see docs/KIRO-VALIDATION.md)
  trace on|off|show                         Record where and when the session-start hook runs (local file only)

Global: --root DIR (default: this workspace)`;

export function main(argv, ctx = {}) {
  const env = ctx.env ?? process.env;
  const out = [];
  const log = (...lines) => out.push(lines.length ? lines.join('\n') : '');
  try {
    const { positional, flags } = parseArgs(argv);
    const root = path.resolve(String(flags.root || flags.target || ctx.root || ctx.cwd || process.cwd()));
    const nowDate = now(env);
    const [cmd, sub, ...rest] = positional;
    const json = !!flags.json && cmd !== 'onboarding' && cmd !== 'evidence'; // --json carries input for those

    switch (cmd) {
      case undefined:
      case 'help':
        log(HELP);
        break;

      case 'init': {
        const runtime = String(flags.runtime || 'kiro');
        if (flags.yes) {
          const r = inst.apply(root, runtime, { env, trace: !!flags.trace });
          log(inst.formatPlan(r.plan));
          log('', `Installed. Runtime status: ${RUNTIME_STATUS[runtime]}`);
          log(runtime === 'kiro'
            ? 'Next: open this folder in Kiro, TRUST the workspace (hooks and steering do not run in an untrusted one), reload the window and start a new chat. If onboarding does not start by itself, type #extelligencing-onboarding.'
            : 'Next: open this folder in your AI runtime and start a new session. Ask "start Extelligencing onboarding" to begin. This integration is experimental and unverified in live sessions.');
        } else {
          log(inst.formatPlan(inst.plan(root, runtime)));
          log('', 'Nothing was changed. Re-run with --yes to apply.');
        }
        break;
      }

      case 'uninstall': {
        if (!flags.yes) throw new ExtelligencingError('Uninstall needs --yes. It removes only unmodified Extelligencing files and keeps your personal data unless --purge-data is given.', 'NEEDS_CONFIRM');
        const r = inst.uninstall(root, { purgeData: !!flags['purge-data'] });
        for (const p of r.removed) log(`removed ${p}`);
        for (const k of r.kept) log(`kept    ${k.path} (${k.why})`);
        log(r.purged ? 'Personal data purged (.extelligencing removed).' : r.dataKept ? 'Personal data kept in .extelligencing/. Use --purge-data to remove it.' : '');
        break;
      }

      case 'doctor': {
        const checks = inst.doctor(root);
        for (const c of checks) log(`${c.level.toUpperCase().padEnd(5)} ${c.msg}`);
        if (checks.some((c) => c.level === 'error')) return done(1);
        break;
      }

      case 'boot': {
        const state = ob.loadState(root);
        const r = ob.bootAction(state, nowDate);
        const trace = ws.loadConfig(root).trace === true;
        const nonce = trace && r.action !== 'silent' ? `EXT-${sha256(String(Date.now()) + root).slice(0, 8)}` : null;
        if (r.action !== 'silent') {
          ob.saveState(root, r.state);
          log(nonce ? `${r.message} Validation code: ${nonce}. If the user asks for the validation code, state it exactly.` : r.message);
        }
        if (trace) writeTrace(root, { action: r.action, nonce, cwd: ctx.cwd ?? null, stdin: summarizeStdin(ctx.stdin) });
        break;
      }

      case 'onboarding': {
        const state = ob.loadState(root);
        const save = (s) => ob.saveState(root, s);
        switch (sub) {
          case 'status':
          case undefined: {
            log(`status: ${state.status}${state.deferred_until ? ` (until ${state.deferred_until})` : ''}`);
            for (const [id, b] of Object.entries(state.blocks)) log(`  ${id.padEnd(14)} ${b.status}${b.until ? ` (until ${b.until})` : ''}`);
            const o = ob.offerableBlocks(state, nowDate);
            if (o.length) log(`offerable when relevant: ${o.join(', ')}`);
            break;
          }
          case 'resume':
            save(ob.start(state));
            log('status: in_progress');
            break;
          case 'defer': {
            const s = ob.defer(state, nowDate, typeof flags.until === 'string' ? flags.until : undefined);
            save(s);
            log(`status: deferred until ${s.deferred_until}`);
            break;
          }
          case 'decline':
            save(ob.decline(state));
            log('status: declined (Extelligencing will not raise onboarding again unless asked)');
            break;
          case 'reset':
            save(ob.reset(state, flags.confirm === true));
            log('onboarding state reset; no files were deleted');
            break;
          case 'block': {
            const [id, status] = rest;
            save(ob.setBlock(state, id, status, nowDate, typeof flags.until === 'string' ? flags.until : undefined));
            log(`block ${id}: ${status}`);
            break;
          }
          case 'activate': {
            const raw = flags.file ? readText(String(flags.file)) : typeof flags.json === 'string' ? flags.json : null;
            if (!raw) throw new ExtelligencingError('Provide --json \'<answers>\' or --file answers.json', 'BAD_ANSWERS');
            let answers;
            try {
              answers = JSON.parse(raw);
            } catch {
              throw new ExtelligencingError('Answers are not valid JSON', 'BAD_ANSWERS');
            }
            const r = ob.activate(root, answers, nowDate);
            const installedRuntime = ws.loadConfig(root).runtime;
            if (r.runtime !== 'other' && installedRuntime !== r.runtime) {
              log(`note: you said you use ${r.runtime}, but Extelligencing is installed for ${installedRuntime}. Run \`init --runtime ${r.runtime} --yes\` to add that adapter.`);
            }
            if (r.shared) {
              try {
                const c = ws.connect(root, r.shared);
                log(`shared workspace connected read-only: ${c.name} -> ${c.path}`);
              } catch (e) {
                log(`shared workspace NOT connected: ${e.message}`);
              }
            }
            for (const w of r.written) log(`wrote ${w}`);
            for (const k of r.kept) log(`kept existing ${k}; the new version is in ${k}.proposed`);
            log('status: completed');
            break;
          }
          default:
            throw new ExtelligencingError(`Unknown onboarding command: ${sub}`, 'BAD_COMMAND');
        }
        break;
      }

      case 'context': {
        if (sub !== 'route') throw new ExtelligencingError('Use: context route --task <shape>', 'BAD_COMMAND');
        const r = route(root, { task: String(flags.task || ''), topic: typeof flags.topic === 'string' ? flags.topic : null, workspace: typeof flags.workspace === 'string' ? flags.workspace : null, showConflicts: !!flags.conflicts });
        log(json ? JSON.stringify(r, null, 2) : formatRoute(r));
        break;
      }

      case 'workspace': {
        switch (sub) {
          case 'connect': {
            const c = ws.connect(root, { name: typeof flags.name === 'string' ? flags.name : undefined, path: rest[0] });
            log(`connected "${c.name}" (${c.access}) -> ${c.path}`);
            log('Extelligencing reads this path only. It never writes, commits or pushes there.');
            break;
          }
          case 'disconnect':
            ws.disconnect(root, rest[0]);
            log(`disconnected ${rest[0]} (the shared folder itself was not touched)`);
            break;
          case 'list': {
            const c = ws.loadConfig(root);
            if (!c.shared.length) log('No shared workspace connected.');
            for (const w of c.shared) log(`${w.name}  ${w.access}  ${w.path}`);
            break;
          }
          case 'check': {
            const rs = ws.check(root, rest[0]);
            if (!rs.length) log('No shared workspace connected.');
            for (const r of rs) {
              log(`${r.name}: ${r.ok ? 'ok' : 'problems'}`);
              for (const f of r.findings) log(`  ${f.level}: ${f.msg}`);
            }
            break;
          }
          case 'read': {
            const w = ws.resolveWorkspace(root, rest[0]);
            if (!w) throw new ExtelligencingError(`No shared workspace named "${rest[0]}"`, 'NOT_FOUND');
            const r = ws.readShared(w, rest[1]);
            log(`[source: ${r.source.workspace}:${r.source.path}]`);
            log(r.content);
            break;
          }
          default:
            throw new ExtelligencingError(`Unknown workspace command: ${sub}`, 'BAD_COMMAND');
        }
        break;
      }

      case 'evidence': {
        switch (sub) {
          case 'propose': {
            let input;
            try {
              input = JSON.parse(String(flags.json || ''));
            } catch {
              throw new ExtelligencingError('Provide the proposal as --json \'{...}\'', 'BAD_PROPOSAL');
            }
            const p = ev.propose(root, input, nowDate);
            log(`proposed ${p.id} (${p.kind}) - status: proposed. Nothing is persisted until the person approves it.`);
            for (const w of p.warnings) log(`warning: ${w}`);
            break;
          }
          case 'list':
            for (const p of ev.list(root, typeof flags.status === 'string' ? flags.status : undefined)) log(`${p.id}  ${p.status.padEnd(9)} ${p.kind}  ${p.summary}`);
            break;
          case 'show':
            log(JSON.stringify(ev.get(root, rest[0]), null, 2));
            break;
          case 'approve': {
            const p = ev.approve(root, rest[0], { confirm: flags.confirm === true }, nowDate);
            log(`approved ${p.id}; persisted to ${p.persisted_to}`);
            break;
          }
          case 'reject': {
            const p = ev.reject(root, rest[0], typeof flags.reason === 'string' ? flags.reason : null, nowDate);
            log(`rejected ${p.id}; nothing was persisted`);
            break;
          }
          case 'defer': {
            const p = ev.defer(root, rest[0], nowDate, typeof flags.until === 'string' ? flags.until : undefined);
            log(`deferred ${p.id} until ${p.until}; nothing was persisted`);
            break;
          }
          default:
            throw new ExtelligencingError(`Unknown evidence command: ${sub}`, 'BAD_COMMAND');
        }
        break;
      }

      case 'trace': {
        const cfg = ws.loadConfig(root);
        if (sub === 'on' || sub === 'off') {
          ws.saveConfig(root, { ...cfg, trace: sub === 'on' });
          log(`trace ${sub}. ${sub === 'on' ? 'Each session-start check is recorded in .extelligencing/trace.log (local, never shared).' : ''}`.trim());
        } else if (sub === 'show') {
          const p = path.join(root, '.extelligencing', 'trace.log');
          log(fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trimEnd() : '(no trace recorded)');
        } else throw new ExtelligencingError('Use: trace on|off|show', 'BAD_COMMAND');
        break;
      }

      case 'runtimes':
        for (const r of SUPPORTED) log(`${r.padEnd(12)} ${RUNTIME_STATUS[r]}`);
        break;

      case 'version':
        log(inst.version());
        break;

      default:
        throw new ExtelligencingError(`Unknown command: ${cmd}\n\n${HELP}`, 'BAD_COMMAND');
    }
    return done(0);
  } catch (e) {
    const err = e instanceof ExtelligencingError ? e.message : `Unexpected error: ${e.stack || e.message}`;
    return { code: e instanceof ExtelligencingError && e.code === 'NEEDS_CONFIRM' ? 3 : 1, out: out.join('\n'), err, errCode: e.code };
  }
  function done(code) {
    return { code, out: out.filter((l, i) => !(l === '' && i === out.length - 1)).join('\n'), err: '' };
  }
}

function writeTrace(root, entry) {
  const p = path.join(root, '.extelligencing', 'trace.log');
  fs.appendFileSync(p, JSON.stringify({ time: new Date().toISOString(), root, ancestors: ancestors(), ...entry }) + '\n');
}

/** Names of the calling processes (up to 5 levels), so a trace shows who really started the hook. Best effort. */
function ancestors() {
  const out = [];
  let pid = process.ppid;
  for (let i = 0; i < 5 && pid > 1; i++) {
    try {
      const [ppid, comm] = execFileSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], { encoding: 'utf8' }).trim().split(/\s+(.*)/);
      out.push(path.basename(comm || '?'));
      pid = Number(ppid);
    } catch {
      break;
    }
  }
  return out;
}

/** Keep structure only: which keys the runtime sent, plus a cwd field if present. */
function summarizeStdin(raw) {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return { keys: Object.keys(j).sort(), cwd: typeof j.cwd === 'string' ? j.cwd : undefined, event: typeof j.hook_event_name === 'string' ? j.hook_event_name : undefined };
  } catch {
    return { unparsed: true, bytes: raw.length };
  }
}
