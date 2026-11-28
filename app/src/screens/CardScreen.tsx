import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Choice, DesignChip, Header, StepBar } from '../components';
import { notify } from '../platform/notify';
import { C, F, s } from '../theme';
import { MusicPicker } from '../MusicPicker';
import type { AiQuality, MusicChoice, MusicTrack, TemplateInfo } from '../types';

export type PickedCard = { uri: string; mimeType?: string | null };

export function CardScreen(props: {
  design: TemplateInfo;
  tracks: MusicTrack[];
  onBack: () => void;
  onMake: (card: PickedCard, quality: AiQuality, music: MusicChoice) => void;
}) {
  const [card, setCard] = useState<PickedCard | null>(null);
  const [quality, setQuality] = useState<AiQuality>('accurate');
  const [music, setMusic] = useState<MusicChoice>({ kind: 'design' });

  async function pick(fromCamera: boolean) {
    // In a browser the file picker / camera asks by itself, so only check permissions in the app.
    const perm =
      Platform.OS === 'web'
        ? { granted: true }
        : fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Permission needed', fromCamera ? 'Allow camera access to photograph the card.' : 'Allow photo access to choose the card.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets?.[0]) setCard({ uri: res.assets[0].uri, mimeType: res.assets[0].mimeType });
  }

  return (
    <SafeAreaView style={s.screen}>
      <Header title="AI card reader" onBack={props.onBack} />
      <ScrollView contentContainerStyle={[s.column, s.scroll]}>
        <StepBar step={2} />
        <DesignChip design={props.design} />

        {card ? (
          <View style={[s.panel, { padding: 8 }]}>
            <Image source={{ uri: card.uri }} style={{ width: '100%', aspectRatio: 0.72, borderRadius: 8 }} resizeMode="contain" />
          </View>
        ) : (
          <View
            style={{
              height: 260,
              borderRadius: 14,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: C.gold,
              backgroundColor: C.surface,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
            }}
          >
            <Ionicons name="sparkles-outline" size={40} color={C.gold} />
            <Text style={[s.body, { fontFamily: F.semi, marginTop: 10, textAlign: 'center' }]}>Photograph the printed card</Text>
            <Text style={[s.small, { textAlign: 'center', marginTop: 4 }]}>
              Our AI reads the names, dates and venues, in English or Urdu, and builds the video from them. Hold the
              phone straight above the card in good light. You can correct anything after.
            </Text>
          </View>
        )}

        <View style={[s.row, { marginTop: 14 }]}>
          <Button
            title={card ? 'Retake' : 'Take photo'}
            icon="camera-outline"
            variant="secondary"
            onPress={() => pick(true)}
            style={{ flex: 1, marginRight: 10 }}
          />
          <Button title="From gallery" icon="images-outline" variant="secondary" onPress={() => pick(false)} style={{ flex: 1 }} />
        </View>

        <Text style={[s.section, { marginTop: 24, marginBottom: 10 }]}>How should the AI read it?</Text>
        <Choice<AiQuality>
          value={quality}
          onChange={setQuality}
          options={[
            { value: 'accurate', title: 'Most accurate', note: 'Best for Urdu, fancy fonts and busy cards. Takes a little longer.' },
            { value: 'approximate', title: 'Approximate', note: 'Faster. Fine for clear, simple cards; check the names after.' },
          ]}
        />
        <View style={{ marginTop: 26 }}>
          <MusicPicker tracks={props.tracks} designMusic={props.design.music_title} value={music} onChange={setMusic} />
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={s.footer}>
        <View style={s.column}>
          <Button title="Create free preview" icon="sparkles-outline" disabled={!card} onPress={() => card && props.onMake(card, quality, music)} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
