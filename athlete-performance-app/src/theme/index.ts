// src/theme/index.ts - Main theme export
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { borderRadius } from './borderRadius';
import { shadows } from './shadows';
import { commonStyles, getPerformanceColor, getPerformanceLevel } from './commonStyles';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export type Theme = typeof theme;

// Export commonStyles and helper functions
export { commonStyles, getPerformanceColor, getPerformanceLevel };