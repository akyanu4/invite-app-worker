import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { C, s } from './theme';

export function Button(props: {
  title: string;
  onPress: () => void;
  ghost?: boolean;
  color?: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { title, onPress, ghost, color, disabled, busy } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        ghost ? s.btnGhost : s.btn,
        color && !ghost ? { backgroundColor: color } : null,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={ghost ? C.gold : '#fff'} />
      ) : (
        <Text style={ghost ? s.btnGhostText : s.btnText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function TopBar(props: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.topBar}>
      {props.onBack ? (
        <Pressable onPress={props.onBack} hitSlop={10}>
          <Text style={s.link}>‹ Back</Text>
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{props.title ?? ''}</Text>
      <View style={{ minWidth: 60, alignItems: 'flex-end' }}>{props.right}</View>
    </View>
  );
}
