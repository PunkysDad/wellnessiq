import { StyleSheet } from 'react-native';
import { appTheme } from './appTheme';
import { colors } from './colors';
import { spacing } from './spacing';
import { borderRadius } from './borderRadius';
import { shadows } from './shadows';
import { typography } from './typography';

export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: appTheme.bg,
  },

  containerPadded: {
    flex: 1,
    backgroundColor: appTheme.bg,
    padding: spacing.base,
  },

  // Card styles
  card: {
    backgroundColor: appTheme.bgCard,
    borderRadius: borderRadius.base,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: appTheme.border,
    ...shadows.base,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  // Text styles
  heading1: {
    ...typography.heading1,
    color: appTheme.text,
  },

  heading2: {
    ...typography.heading2,
    color: appTheme.text,
  },

  heading3: {
    ...typography.heading3,
    color: appTheme.text,
  },

  body: {
    ...typography.body,
    color: appTheme.text,
  },

  bodySecondary: {
    ...typography.body,
    color: appTheme.textMuted,
  },

  caption: {
    ...typography.caption,
    color: appTheme.textMuted,
  },

  // Layout styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Button styles
  primaryButton: {
    backgroundColor: appTheme.red,
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: appTheme.red,
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  // Performance stat colors
  performanceExcellent: { color: colors.performance.excellent },
  performanceGood:      { color: colors.performance.good },
  performanceAverage:   { color: colors.performance.average },
  performanceNeedsWork: { color: colors.performance.needsWork },
  performancePoor:      { color: colors.performance.poor },
});

export const getPerformanceColor = (score: number): string => {
  if (score >= 90) return colors.performance.excellent;
  if (score >= 80) return colors.performance.good;
  if (score >= 70) return colors.performance.average;
  if (score >= 60) return colors.performance.needsWork;
  return colors.performance.poor;
};

export const getPerformanceLevel = (score: number): string => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Average';
  if (score >= 60) return 'Needs Work';
  return 'Poor';
};