# Extelligencing Evidence and Persistence Policy

Nothing becomes a lasting fact about the professional, or a lasting change to their configuration, because a model inferred it.

## Kinds

| Kind | Meaning | Bar to propose |
|---|---|---|
| `observation` | One thing that happened | One concrete instance |
| `hypothesis` | A possible interpretation | Labeled as a guess; never treated as fact |
| `repeated_pattern` | Same behavior across contexts | 3 or more independent instances |
| `preference` | Something the person said they want | Their explicit statement |
| `decision` | A choice the person made | Their explicit statement |
| `validated_learning` | A pattern linked to a measured outcome | Evidence references plus the person's confirmation |

Instances are independent only if they differ in artifact or event, trigger, and time. A restatement is not a second instance.

## Flow

**Observe, propose, review, approve, persist.**

1. Observe silently. Most work produces nothing worth proposing. That is the expected result.
2. If something is genuinely notable, mention at most one line at the end of a response, or hold it.
3. When the person agrees to consider it, create a proposal: `extelligencing evidence propose` (status `proposed`). A proposal has no authority.
4. Show the proposal and its weaknesses. Seek counter-evidence.
5. The person approves, rejects or defers. Only an explicit approval of that specific proposal persists it (`extelligencing evidence approve <id> --confirm`).
6. Rejected and deferred proposals are never persisted. Do not re-propose a rejected item unless there is new evidence.

## Rules

- Never infer capability levels, performance ratings or personal traits without sufficient evidence and explicit approval. Prefer writing nothing.
- Preferences and decisions need the person's own words, not your interpretation.
- Strip real names of other people, customers, ticket identifiers, secrets and confidential figures from anything proposed. If the abstraction no longer says something true, do not persist it.
- Team or company information never goes into personal evidence. Personal evidence never goes into a shared workspace unless the person explicitly authorizes that specific export.
- Never pass `--confirm` unless the person has just approved that exact proposal in this conversation.
