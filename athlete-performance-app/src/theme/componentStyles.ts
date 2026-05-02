import { StyleSheet, Platform } from 'react-native';
import { appTheme } from './appTheme';
import { theme } from './index';

/**
 * Shared component styles — import these in screens instead of redefining.
 * Each screen should only define styles that are truly unique to that screen.
 */
export const componentStyles = StyleSheet.create({

  // ── Screen headers ────────────────────────────────────────────────────────
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  screenHeaderTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: appTheme.white,
    letterSpacing: -0.5,
  },
  screenHeaderSubtitle: {
    fontSize: 13,
    color: appTheme.textMuted,
    marginTop: 3,
    fontWeight: '500',
  },

  // ── Glass cards ───────────────────────────────────────────────────────────
  glassCard: {
    backgroundColor: appTheme.bgCard,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appTheme.border,
    overflow: 'hidden',
    // Simulate glass depth with a subtle inner highlight
    shadowColor: appTheme.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  glassCardAccent: {
    // Glass card with a purple accent left border
    backgroundColor: appTheme.bgCard,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
    overflow: 'hidden',
    shadowColor: appTheme.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },

  glassCardOrb: {
    backgroundColor: appTheme.bgCard,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appTheme.border,
    overflow: 'hidden',
    shadowColor: appTheme.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  glassCardOrbAccent: {
    backgroundColor: appTheme.bgCard,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: appTheme.borderAccent,
    overflow: 'hidden',
    shadowColor: appTheme.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },

  // ── Card content padding ──────────────────────────────────────────────────
  cardPadding: {
    padding: 20,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: appTheme.white,
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 14,
    color: appTheme.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  cardCaption: {
    fontSize: 12,
    color: appTheme.textMuted,
    lineHeight: 16,
  },

  // ── Stat cards (2-per-row grid) ───────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 28,
    marginBottom: 12,
    alignItems: 'center',
    backgroundColor: appTheme.bgElevated,
    borderWidth: 1.5,
    borderColor: appTheme.border,  // will be overridden inline per card
    position: 'relative',
    shadowColor: appTheme.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  statCardTouchable: {
    borderColor: appTheme.borderAccent,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: appTheme.white,
    marginTop: 8,
    letterSpacing: -1,
  },
  statLabel: {
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    color: appTheme.text,
    letterSpacing: 0.3,
  },
  statSubtitle: {
    marginTop: 2,
    textAlign: 'center',
    fontSize: 10,
    color: appTheme.textMuted,
  },
  statTouchIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: appTheme.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: appTheme.purple,
  },
  tabText: {
    fontSize: 15,
    color: appTheme.textMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: appTheme.white,
    fontWeight: '800',
  },

  // ── Pill badges ───────────────────────────────────────────────────────────
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  purpleBadge: {
    backgroundColor: appTheme.purpleDim,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.40)',
  },
  purpleBadgeText: {
    color: appTheme.purple,
  },

  // ── Row layout helpers ────────────────────────────────────────────────────
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── Centered / empty state ────────────────────────────────────────────────
  centered: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 14,
    color: appTheme.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  emptyStateCaption: {
    fontSize: 12,
    color: appTheme.textFaint,
    textAlign: 'center',
    marginTop: 6,
  },
});
