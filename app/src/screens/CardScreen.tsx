import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { notify } from '../platform/notify';
import { C, s } from '../theme';

export type PickedCard = { uri: string; mimeType?: string | null };

export function CardScreen(props: { designTitle: string; onBack: () => void; onMake: (card: PickedCard) => void }) {
  const [card, setCard] = useState<PickedCard | null>(null);

  async function pick(fromCamera: boolean) {
    // In a browser the file picker / camera asks by itself, so only check permissions in the app.
    const perm =
      Platform.OS === 'web'
        ? { granted: true }
        : fromCamera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notify('Permission needed', fromCamera ? 'Allow camera access to photograph the card.' : 'Allow photo access to pick the card.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets?.[0]) {
      setCard({ uri: res.assets[0].uri, mimeType: res.assets[0].mimeType });
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <TopBar title="Scan a card" onBack={props.onBack} />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={[s.p, { marginBottom: 8 }]}>
          Design: <Text style={{ fontWeight: '700', color: C.text }}>{props.designTitle}</Text>
        </Text>
        <Text style={s.p}>
          Take a clear, straight photo of the printed card in good light. The names, dates and venues are read
          automatically. You can correct anything afterwards.
        </Text>

        {card ? (
          <View style={[s.card, { padding: 8, marginTop: 16 }]}>
            <Image source={{ uri: card.uri }} style={{ width: '100%', aspectRatio: 0.72, borderRadius: 8 }} resizeMode="contain" />
          </View>
        ) : (
          <View
            style={[
              s.card,
              { marginTop: 16, height: 220, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
            ]}
          >
            <Text style={{ color: C.muted }}>No card photo yet</Text>
          </View>
        )}

        <Button title={card ? 'Retake photo' : 'Take photo'} onPress={() => pick(true)} ghost={!!card} />
        <Button title="Choose from gallery" onPress={() => pick(false)} ghost />
        {card && <Button title="Make the video" onPress={() => props.onMake(card)} />}
      </ScrollView>
    </SafeAreaView>
  );
}
