import { appTheme } from './appTheme';

export const colors = {
  primary:      appTheme.red,
  primaryDark:  appTheme.redDark,
  primaryLight: '#a78bfa',
  secondary:    appTheme.silver,
  secondaryDark: appTheme.textMuted,

  // Background colors
  background: appTheme.bg,
  surface:    appTheme.bgCard,
  card:       appTheme.bgCard,

  // Text colors
  text:          appTheme.text,
  textSecondary: appTheme.textMuted,
  textTertiary:  appTheme.textLight,
  textLight:     appTheme.white,

  // Status colors
  success: appTheme.success,
  warning: appTheme.warning,
  error:   appTheme.error,
  info:    '#3b82f6',

  // Performance colors
  performance: {
    excellent: '#22c55e',
    good:      '#84cc16',
    average:   '#f59e0b',
    needsWork: '#f97316',
    poor:      '#e03e2d',
  },

  // Border colors
  border:      appTheme.border,
  borderLight: appTheme.borderLight,

  // Overlay colors
  overlay:      'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};