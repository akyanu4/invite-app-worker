import { Platform, StyleSheet } from 'react-native';

// Palette taken from printed South Asian wedding cards: henna maroon and gold leaf on pearl paper.
export const C = {
  bg: '#F7F3F1', // pearl
  surface: '#FFFFFF',
  ink: '#24191B',
  muted: '#7B6A6C',
  faint: '#A89A9C',
  line: '#EADFDC',
  maroon: '#6B1E2B',
  maroonPress: '#521520',
  maroonSoft: '#F4E7E8',
  gold: '#B48A3C',
  goldSoft: '#F5EDDF',
  whatsapp: '#1F9D55',
  danger: '#B3261E',
  success: '#2E7D4F',
};

export const F = {
  display: 'Marcellus_400Regular',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semi: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
};

export const MAX_W = 560; // keeps the layout phone-shaped on tablets and desktops

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  column: { width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  display: { fontFamily: F.display, fontSize: 28, lineHeight: 35, color: C.ink },
  title: { fontFamily: F.display, fontSize: 22, lineHeight: 28, color: C.ink },
  section: { fontFamily: F.display, fontSize: 18, lineHeight: 24, color: C.ink },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.ink },
  muted: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.muted },
  small: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  label: { fontFamily: F.semi, fontSize: 13, lineHeight: 18, color: C.ink, marginBottom: 6 },

  panel: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
  },
  input: {
    fontFamily: F.body,
    fontSize: 16, // 16px stops iPhone Safari zooming into the field
    color: C.ink,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    ...(Platform.OS === 'web' ? ({ outlineColor: C.maroon } as object) : null),
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
});
