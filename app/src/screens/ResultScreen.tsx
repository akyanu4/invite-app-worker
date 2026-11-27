import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header, StepBar } from '../components';
import { notify } from '../platform/notify';
import { SAVE_LABEL, saveVideo, shareVideo } from '../platform/video';
import { C, s } from '../theme';
import type { HistoryItem } from '../types';

export function ResultScreen(props: { item: HistoryItem; fromCard: boolean; onHome: () => void; onEdit: () => void }) {
  const { item } = props;
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
    // Browsers only autoplay muted video; tap the speaker icon to hear the music.
    if (Platform.OS === 'web') p.muted = true;
    p.play();
  });
  const [busy, setBusy] = useState<'' | 'share' | 'save'>('');

  // Start playback once the video has loaded (an early play() is ignored in browsers).
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !player.playing) player.play();
    });
    return () => sub.remove();
  }, [player]);

  async function share() {
    try {
      setBusy('share');
      const msg = await shareVideo(item);
      if (msg) notify('Video downloaded', msg);
    } catch (e) {
      notify('Couldn’t open sharing', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    try {
      setBusy('save');
      notify('Saved', await saveVideo(item));
    } catch (e) {
      notify('Couldn’t save the video', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <Header title="Your video" onBack={props.onHome} />
      <ScrollView contentContainerStyle={[s.column, s.scroll]}>
        <StepBar step={3} done />
        <View style={{ width: '72%', maxWidth: 300, alignSelf: 'center', aspectRatio: 9 / 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
          <VideoView player={player} nativeControls playsInline contentFit="contain" style={{ width: '100%', height: '100%' }} />
        </View>
        <Text style={[s.title, { textAlign: 'center', marginTop: 16 }]}>{item.title}</Text>
        {Platform.OS === 'web' && <Text style={[s.small, { textAlign: 'center', marginTop: 2 }]}>Tap the speaker on the video to hear the music.</Text>}
        {props.fromCard && (
          <View style={[s.panel, { marginTop: 16, backgroundColor: C.goldSoft, borderColor: C.goldSoft }]}>
            <Text style={[s.small, { color: C.ink }]}>
              The details were read from the card automatically. Check the names and dates before you send it, and use
              Edit details if anything needs correcting.
            </Text>
          </View>
        )}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={s.footer}>
        <View style={s.column}>
          <Button title="Share on WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={share} busy={busy === 'share'} disabled={!!busy} />
          <View style={[s.row, { marginTop: 10 }]}>
            <Button
              title={SAVE_LABEL}
              icon="download-outline"
              variant="secondary"
              onPress={save}
              busy={busy === 'save'}
              disabled={!!busy}
              style={{ flex: 1, marginRight: 10 }}
            />
            <Button title="Edit details" icon="create-outline" variant="secondary" onPress={props.onEdit} style={{ flex: 1 }} />
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
