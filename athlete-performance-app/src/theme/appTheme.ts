export const appTheme = {
  // ── Base backgrounds ──────────────────────────────────────────────────────
  bg:             '#080B14',        // True deep dark (OLED-friendly)
  bgCard:         'rgba(255,255,255,0.06)',  // Glassmorphic card surface
  bgElevated:     'rgba(255,255,255,0.10)', // Elevated glass surface
  bgOverlay:      'rgba(8,11,20,0.85)',     // Modal overlay

  // ── Gradient orbs (ambient glow behind glass cards) ──────────────────────
  orbPurple:      '#7C3AED',
  orbBlue:        '#2563EB',
  orbCyan:        '#06B6D4',

  // ── Accent colors ─────────────────────────────────────────────────────────
  purple:         '#8B5CF6',        // Primary interactive
  purpleLight:    '#A78BFA',
  purpleDim:      'rgba(139,92,246,0.20)',
  neonGreen:      '#39FF14',        // Success / active states
  neonGreenDim:   'rgba(57,255,20,0.15)',
  cyan:           '#06B6D4',        // Secondary accent
  cyanDim:        'rgba(6,182,212,0.15)',

  // ── Legacy / kept for backward compat ─────────────────────────────────────
  red:            '#8B5CF6',        // Remap red → purple for retheme
  redDark:        '#7C3AED',
  redGlow:        '#8B5CF626',
  navy:           '#1E3A5F',
  navyDark:       '#080B14',
  navyLight:      '#1A2744',

  // ── Text ──────────────────────────────────────────────────────────────────
  white:          '#FFFFFF',
  text:           '#E2E8F0',
  textMuted:      '#64748B',
  textFaint:      '#334155',
  textLight:      '#334155',

  // ── Borders ───────────────────────────────────────────────────────────────
  border:         'rgba(255,255,255,0.08)',
  borderLight:    'rgba(255,255,255,0.04)',
  borderAccent:   'rgba(139,92,246,0.40)',
  borderGlow:     'rgba(57,255,20,0.30)',

  // ── Silver (keep for existing usage) ──────────────────────────────────────
  silver:         '#64748B',

  // ── Semantic ───────────────────────────────────────────────────────────────
  success:     '#22c55e',
  warning:     '#f59e0b',
  error:       '#e03e2d',

  // ── Legacy aliases ──
  gray:        '#080B14',
  white2:      '#ffffff',
};
