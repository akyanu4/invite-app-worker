import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header } from '../components';
import { testConnection } from '../cloudinary';
import { C, s } from '../theme';
import type { Settings } from '../types';

export function SettingsScreen(props: { settings: Settings; onSave: (s: Settings) => Promise<void>; onBack: () => void }) {
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

  const field = (k: keyof Settings, label: string, placeholder: string, help?: string) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={v[k]}
        onChangeText={(t) => set(k, t)}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {help && <Text style={[s.small, { marginTop: 6 }]}>{help}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={s.screen}>
      <Header title="Settings" onBack={props.onBack} />
      <ScrollView contentContainerStyle={[s.column, s.scroll]} keyboardShouldPersistTaps="handled">
        <Text style={s.section}>Cloudinary connection</Text>
        <Text style={[s.small, { marginTop: 4, marginBottom: 16 }]}>
          The app sends each invitation to Cloudinary, where your rendering PC picks it up.
        </Text>
        <View style={[s.panel, { paddingBottom: 2 }]}>
          {field('cloudName', 'Cloud name', 'your cloud name')}
          {field('uploadPreset', 'Unsigned upload preset', 'invites_unsigned')}
          {field('folder', 'Folder', 'invites', 'Must match INVITE_CLOUDINARY_FOLDER on the PC.')}
        </View>
        <Button title="Save and test connection" onPress={test} busy={busy} style={{ marginTop: 16 }} />
        {msg && (
          <View style={[s.row, { marginTop: 14, alignItems: 'flex-start' }]}>
            <Ionicons name={msg.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={msg.ok ? C.success : C.danger} />
            <Text style={[s.body, { flex: 1, marginLeft: 8, color: msg.ok ? C.success : C.danger }]}>{msg.text}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
