export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },
  
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  
  // Calculate actual line heights based on font sizes
  lineHeight: {
    tight: (fontSize: number) => Math.round(fontSize * 1.2),
    normal: (fontSize: number) => Math.round(fontSize * 1.4),
    relaxed: (fontSize: number) => Math.round(fontSize * 1.6),
  },
  
  // Pre-defined text styles with calculated line heights
  heading1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: Math.round(32 * 1.2), // 38px
  },
  heading2: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: Math.round(28 * 1.2), // 34px
  },
  heading3: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: Math.round(24 * 1.2), // 29px
  },
  heading4: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: Math.round(20 * 1.3), // 26px
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: Math.round(16 * 1.4), // 22px
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: Math.round(14 * 1.4), // 20px
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: Math.round(12 * 1.3), // 16px
  },
};