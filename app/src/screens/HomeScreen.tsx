import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { useInstallPrompt } from '../platform/install';
import { confirm } from '../platform/notify';
import { C, s } from '../theme';
import type { HistoryItem } from '../types';

export function HomeScreen(props: {
  history: HistoryItem[];
  configured: boolean;
  onScanCard: () => void;
  onTypeDetails: () => void;
  onOpen: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
  onSettings: () => void;
}) {
  const { history, configured } = props;
  const inst = useInstallPrompt();
  return (
    <SafeAreaView style={s.screen}>
      <TopBar
        right={
          <Pressable onPress={props.onSettings} hitSlop={10}>
            <Text style={s.link}>Settings</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>Invitation videos</Text>
        <Text style={s.p}>
          Turn an invitation card or a few details into an animated video you can share on WhatsApp.
        </Text>

        {!configured && (
          <View style={[s.card, { backgroundColor: C.goldLight, marginTop: 16 }]}>
            <Text style={{ color: C.text, fontWeight: '600' }}>One-time setup needed</Text>
            <Text style={[s.p, { marginTop: 4 }]}>
              Add your Cloudinary cloud name and upload preset in Settings.
            </Text>
            <Button title="Open Settings" onPress={props.onSettings} ghost />
          </View>
        )}

        {inst.show && (
          <View style={[s.card, { marginTop: 16, borderColor: C.gold }]}>
            <Text style={{ color: C.text, fontWeight: '700' }}>Install this app</Text>
            <Text style={[s.p, { marginTop: 4, fontSize: 14 }]}>
              {inst.canPrompt
                ? 'Add it to your home screen so it opens like a normal app.'
                : inst.isIOS
                  ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
                  : 'In Chrome, tap the ⋮ menu, then “Install app” or “Add to Home screen”.'}
            </Text>
            {inst.canPrompt && <Button title="Install" onPress={inst.install} />}
            <Button title="Not now" ghost onPress={inst.dismiss} />
          </View>
        )}

        <View style={{ marginTop: 12 }}>
          <Button title="📷  Scan a printed card" onPress={props.onScanCard} disabled={!configured} />
          <Button title="✍️  Type the details" onPress={props.onTypeDetails} ghost disabled={!configured} />
        </View>

        {history.length > 0 && (
          <>
            <Text style={s.h2}>Your videos</Text>
            {history.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => props.onOpen(h)}
                onLongPress={async () => {
                  if (await confirm('Remove from list?', h.title, 'Remove')) props.onDelete(h);
                }}
                style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>{h.title}</Text>
                <Text style={[s.p, { fontSize: 13, marginTop: 2 }]}>
                  {new Date(h.createdAt).toLocaleString()}
                </Text>
              </Pressable>
            ))}
            <Text style={[s.p, { fontSize: 12 }]}>Long-press a video to remove it from this list.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
