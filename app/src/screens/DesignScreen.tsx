import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { fetchTemplates } from '../cloudinary';
import { PreviewVideo } from '../PreviewVideo';
import { C, s } from '../theme';
import type { Settings, TemplateInfo } from '../types';

export function DesignScreen(props: {
  settings: Settings;
  selected?: string;
  onBack: () => void;
  onPick: (t: TemplateInfo) => void;
}) {
  const [list, setList] = useState<TemplateInfo[] | null>(null);
  const [sel, setSel] = useState<string | undefined>(props.selected);

  useEffect(() => {
    let alive = true;
    fetchTemplates(props.settings).then((l) => {
      if (!alive) return;
      setList(l);
      setSel((cur) => (cur && l.some((t) => t.id === cur) ? cur : l[0]?.id));
    });
    return () => {
      alive = false;
    };
  }, [props.settings]);

  const chosen = list?.find((t) => t.id === sel);

  return (
    <SafeAreaView style={s.screen}>
      <TopBar title="Choose a design" onBack={props.onBack} />
      {!list ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.p}>Every design uses the same details, so you can switch later.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 }}>
            {list.map((t) => {
              const on = t.id === sel;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSel(t.id)}
                  style={{
                    width: '48%',
                    marginBottom: 14,
                    borderRadius: 14,
                    borderWidth: on ? 3 : 1,
                    borderColor: on ? C.gold : C.border,
                    backgroundColor: C.card,
                    overflow: 'hidden',
                  }}
                >
                  {t.preview_video_url ? (
                    <PreviewVideo uri={t.preview_video_url} style={{ width: '100%', aspectRatio: 9 / 16 }} />
                  ) : t.preview_url ? (
                    <Image source={{ uri: t.preview_url }} style={{ width: '100%', aspectRatio: 9 / 16 }} resizeMode="cover" />
                  ) : (
                    <View
                      style={{ width: '100%', aspectRatio: 9 / 16, backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.goldDark }}>No preview</Text>
                    </View>
                  )}
                  <View style={{ padding: 10 }}>
                    <Text style={{ fontWeight: '700', color: C.text }}>
                      {on ? '✓ ' : ''}
                      {t.title}
                    </Text>
                    {!!t.description && (
                      <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }} numberOfLines={3}>
                        {t.description}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {list.length === 1 && (
            <Text style={[s.p, { fontSize: 12 }]}>
              More designs appear here automatically once they are added on the rendering PC.
            </Text>
          )}
          <Button title={chosen ? `Use “${chosen.title}”` : 'Continue'} disabled={!chosen} onPress={() => chosen && props.onPick(chosen)} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
