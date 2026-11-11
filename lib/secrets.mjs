// Heuristic checks for secrets, personal data and prompt-injection-like text.
// These are guard rails, not guarantees. Documented as such.

const SECRET_PATTERNS = [
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['bearer-token', /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/],
  ['generic-secret', /\b(?:api[_-]?key|secret|token|passw(?:or)?d)\b\s*[:=]\s*["']?[A-Za-z0-9\/+_.-]{16,}/i],
];

const PII_PATTERNS = [['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/]];

const INJECTION_PATTERNS = [
  ['ignore-instructions', /\bignore (?:all |any )?(?:previous|prior|above) (?:instructions|rules)\b/i],
  ['role-override', /\byou are now (?:a|an|the)\b/i],
  ['rule-override', /\b(?:disregard|override|bypass) (?:the )?(?:kernel|system prompt|safety|rules|guardrails)\b/i],
  ['write-personal', /\b(?:write|copy|upload|send) (?:to|into) (?:the )?(?:\.extelligencing|personal (?:profile|memory))\b/i],
];

/** Placeholder domains used by synthetic examples are allowed. */
const SAFE_EMAIL = /@(?:example\.(?:com|org|net|invalid)|[a-z0-9-]+\.example|users\.noreply\.[a-z.]+)$/i;

export function scanSecrets(text) {
  const out = [];
  for (const [id, re] of SECRET_PATTERNS) if (re.test(text)) out.push({ id, severity: 'high' });
  return out;
}

export function scanPii(text) {
  const out = [];
  for (const [id, re] of PII_PATTERNS) {
    const g = new RegExp(re.source, 'g');
    for (const m of text.matchAll(g)) {
      if (!SAFE_EMAIL.test(m[0])) {
        out.push({ id, severity: 'medium' });
        break;
      }
    }
  }
  return out;
}

export function scanInjection(text) {
  const out = [];
  for (const [id, re] of INJECTION_PATTERNS) if (re.test(text)) out.push({ id, severity: 'medium' });
  return out;
}
