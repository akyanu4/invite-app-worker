import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { PreviewVideo } from './PreviewVideo';
import { C, F } from './theme';
import type { TemplateInfo } from './types';

const GAP = 10;

/** Three small looping video boxes per row. */
export function TemplateGrid(props: {
  templates: TemplateInfo[] | null;
  selected?: string;
  onPick: (t: TemplateInfo) => void;
}) {
  const list = props.templates;
  if (!list) {
    return (
      <View style={{ flexDirection: 'row', marginHorizontal: -GAP / 2 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: '33.333%', paddingHorizontal: GAP / 2 }}>
            <View style={{ aspectRatio: 9 / 16, borderRadius: 10, backgroundColor: C.line }} />
            <View style={{ height: 10, width: '70%', borderRadius: 5, backgroundColor: C.line, marginTop: 8 }} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GAP / 2 }}>
      {list.map((t) => {
        const on = t.id === props.selected;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`${t.title} design`}
            onPress={() => props.onPick(t)}
            style={({ pressed }) => ({ width: '33.333%', paddingHorizontal: GAP / 2, marginBottom: 16, opacity: pressed ? 0.8 : 1 })}
          >
            <View
              style={{
                aspectRatio: 9 / 16,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: C.line,
                borderWidth: on ? 2 : 0,
                borderColor: C.maroon,
              }}
            >
              {t.preview_video_url ? (
                <PreviewVideo uri={t.preview_video_url} poster={t.preview_url} style={{ width: '100%', height: '100%' }} />
              ) : t.preview_url ? (
                <Image source={{ uri: t.preview_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : null}
            </View>
            <Text numberOfLines={1} style={{ marginTop: 7, fontFamily: on ? F.bold : F.semi, fontSize: 13, color: on ? C.maroon : C.ink }}>
              {t.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
