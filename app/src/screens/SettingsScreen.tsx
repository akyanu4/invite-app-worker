import React, { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { testConnection } from '../cloudinary';
import { C, s } from '../theme';
import type { Settings } from '../types';

export function SettingsScreen(props: {
  settings: Settings;
  onSave: (s: Settings) => Promise<void>;
  onBack: () => void;
}) {
  const [v, setV] = useState<Settings>(props.settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Settings, val: string) => setV((x) => ({ ...x, [k]: val.trim() }));

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      await props.onSave(v);
      setMsg({ ok: true, text: await testConnection(v) });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <TopBar title="Settings" onBack={props.onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.p}>
          These connect the app to your Cloudinary account. The rendering PC picks up the jobs from there.
        </Text>

        <Text style={s.label}>Cloud name</Text>
        <TextInput
          style={s.input}
          value={v.cloudName}
          onChangeText={(t) => set('cloudName', t)}
          placeholder="your cloud name"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>Unsigned upload preset</Text>
        <TextInput
          style={s.input}
          value={v.uploadPreset}
          onChangeText={(t) => set('uploadPreset', t)}
          placeholder="invites_unsigned"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>Folder</Text>
        <TextInput
          style={s.input}
          value={v.folder}
          onChangeText={(t) => set('folder', t)}
          placeholder="invites"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[s.p, { fontSize: 12, marginTop: 4 }]}>
          Must match INVITE_CLOUDINARY_FOLDER on the PC (default: invites).
        </Text>

        <Button title="Save & test connection" onPress={test} busy={busy} />
        {msg && <Text style={{ marginTop: 12, color: msg.ok ? C.green : C.danger }}>{msg.text}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
