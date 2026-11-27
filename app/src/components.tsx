import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { C, F, s } from './theme';
import type { TemplateInfo } from './types';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Variant = 'primary' | 'secondary' | 'quiet' | 'whatsapp';

export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = props.variant ?? 'primary';
  const filled = v === 'primary' || v === 'whatsapp';
  const bg = v === 'primary' ? C.maroon : v === 'whatsapp' ? C.whatsapp : v === 'secondary' ? C.surface : 'transparent';
  const fg = filled ? '#fff' : C.maroon;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled || props.busy}
      style={({ pressed }) => [
        {
          height: 52,
          borderRadius: 12,
          backgroundColor: bg,
          borderWidth: v === 'secondary' ? 1 : 0,
          borderColor: C.line,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 18,
          opacity: props.disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        props.style,
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {props.icon && <Ionicons name={props.icon} size={20} color={fg} style={{ marginRight: 8 }} />}
          <Text style={{ fontFamily: F.semi, fontSize: 16, color: fg }}>{props.title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton(props: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? C.line : 'transparent',
      })}
    >
      <Ionicons name={props.icon} size={22} color={props.color ?? C.ink} />
    </Pressable>
  );
}

/** Top bar: back arrow + title, or the brand on the home screen. */
export function Header(props: { title?: string; onBack?: () => void; right?: React.ReactNode; brand?: boolean }) {
  return (
    <View style={[s.column, { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }]}>
      {props.brand ? (
        <View style={[s.row, { flex: 1, paddingLeft: 8 }]}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: C.maroon,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons name="mail-open-outline" size={17} color="#E9CF96" />
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>Quick Invitations</Text>
        </View>
      ) : (
        <>
          {props.onBack ? <IconButton icon="arrow-back" label="Back" onPress={props.onBack} /> : <View style={{ width: 40 }} />}
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: F.semi, fontSize: 16, color: C.ink }}>
            {props.title ?? ''}
          </Text>
        </>
      )}
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{props.right}</View>
    </View>
  );
}

const STEPS = ['Design', 'Details', 'Video'];

/** Where the person is in the three-step flow. */
export function StepBar(props: { step: 1 | 2 | 3; done?: boolean }) {
  return (
    <View style={[s.row, { marginBottom: 18 }]}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const complete = n < props.step || (props.done && n === props.step);
        const current = n === props.step && !props.done;
        return (
          <View key={label} style={{ flex: 1, marginRight: i < 2 ? 6 : 0 }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: complete ? C.gold : current ? C.maroon : C.line }} />
            <Text
              style={{
                marginTop: 6,
                fontFamily: current ? F.semi : F.medium,
                fontSize: 12,
                color: current ? C.maroon : complete ? C.ink : C.faint,
              }}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Compact "Design: <thumb> name   Change" row used in the flow. */
export function DesignChip(props: { design: TemplateInfo; onChange?: () => void }) {
  return (
    <View style={[s.panel, s.row, { padding: 10, marginBottom: 18 }]}>
      {props.design.preview_url ? (
        <Image source={{ uri: props.design.preview_url }} style={{ width: 34, height: 60, borderRadius: 6, backgroundColor: C.line }} />
      ) : (
        <View style={{ width: 34, height: 60, borderRadius: 6, backgroundColor: C.goldSoft }} />
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.small}>Design</Text>
        <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{props.design.title}</Text>
      </View>
      {props.onChange && (
        <Pressable onPress={props.onChange} hitSlop={10} accessibilityRole="button">
          <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.maroon, padding: 6 }}>Change</Text>
        </Pressable>
      )}
    </View>
  );
}
