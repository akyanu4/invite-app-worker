import React from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header } from '../components';
import { PreviewVideo } from '../PreviewVideo';
import { C, s } from '../theme';
import type { Category, TemplateInfo } from '../types';

/** Larger preview of one design, with the two ways to continue. */
export function TemplateScreen(props: {
  design: TemplateInfo;
  category?: Category;
  onBack: () => void;
  onType: () => void;
  onScan: () => void;
}) {
  const t = props.design;
  const cat = props.category;
  const includes = cat
    ? [...cat.sections.map((sec) => sec.title), `${cat.events.title}: date, time and venue`]
    : ['Names, dates and venue'];
  return (
    <SafeAreaView style={s.screen}>
      <Header title="Design" onBack={props.onBack} />
      <ScrollView contentContainerStyle={[s.column, s.scroll]}>
        <View
          style={{
            width: '62%',
            maxWidth: 260,
            alignSelf: 'center',
            aspectRatio: 9 / 16,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: C.line,
          }}
        >
          {t.preview_video_url ? (
            <PreviewVideo uri={t.preview_video_url} poster={t.preview_url} style={{ width: '100%', height: '100%' }} />
          ) : t.preview_url ? (
            <Image source={{ uri: t.preview_url }} style={{ width: '100%', height: '100%' }} />
          ) : null}
        </View>

        <Text style={[s.title, { marginTop: 22 }]}>{t.title}</Text>
        {!!t.description && <Text style={[s.muted, { marginTop: 6 }]}>{t.description}</Text>}

        <View style={{ marginTop: 18 }}>
          {includes.map((line) => (
            <View key={line} style={[s.row, { marginBottom: 8, alignItems: 'flex-start' }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold, marginTop: 8, marginRight: 10 }} />
              <Text style={[s.body, { flex: 1 }]}>{line}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.small, { marginTop: 6 }]}>
          Your names and dates replace the sample text. The preview is free; you pay only to download the video without the
          watermark.
        </Text>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={s.footer}>
        <View style={s.column}>
          <Button title="Type the details" icon="create-outline" onPress={props.onType} />
          <Button title="Scan a printed card" icon="camera-outline" variant="secondary" onPress={props.onScan} style={{ marginTop: 10 }} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

