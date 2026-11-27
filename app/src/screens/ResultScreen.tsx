import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { C, s } from '../theme';
import { notify } from '../platform/notify';
import { SAVE_LABEL, saveVideo, shareVideo } from '../platform/video';
import type { HistoryItem } from '../types';

export function ResultScreen(props: {
  item: HistoryItem;
  fromCard: boolean;
  onHome: () => void;
  onEdit: () => void;
}) {
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
      if (msg) notify('Downloaded', msg);
    } catch (e) {
      notify('Could not share', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    try {
      setBusy('save');
      notify('Saved', await saveVideo(item));
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <TopBar title={item.title} onBack={props.onHome} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={{ alignItems: 'center' }}>
          <VideoView
            player={player}
            nativeControls
            contentFit="contain"
            style={{ width: '78%', aspectRatio: 9 / 16, borderRadius: 12, backgroundColor: '#000' }}
          />
        </View>

        <Button
          title="Share on WhatsApp"
          color={C.whatsapp}
          onPress={share}
          busy={busy === 'share'}
          disabled={!!busy}
        />
        <Text style={[s.p, { fontSize: 12, textAlign: 'center', marginTop: 6 }]}>
          Opens the share menu. Pick WhatsApp, then the chats or groups.
        </Text>
        <Button title={SAVE_LABEL} ghost onPress={save} busy={busy === 'save'} disabled={!!busy} />
        <Button title={props.fromCard ? 'Fix the details & remake' : 'Edit details & remake'} ghost onPress={props.onEdit} />

        {props.fromCard && (
          <Text style={[s.p, { fontSize: 13, marginTop: 14 }]}>
            The details were read from the card automatically. Check names and dates before sending, and use “Fix the
            details” if anything is wrong.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
