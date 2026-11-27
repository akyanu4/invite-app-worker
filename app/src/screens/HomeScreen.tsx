import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header, IconButton } from '../components';
import { useInstallPrompt } from '../platform/install';
import { confirm } from '../platform/notify';
import { TemplateGrid } from '../TemplateGrid';
import { C, F, s } from '../theme';
import type { HistoryItem, TemplateInfo } from '../types';

export function HomeScreen(props: {
  templates: TemplateInfo[] | null;
  history: HistoryItem[];
  configured: boolean;
  onPickTemplate: (t: TemplateInfo) => void;
  onOpen: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
  onSettings: () => void;
}) {
  const { history, configured, templates } = props;
  const inst = useInstallPrompt();
  const thumb = (id?: string) => templates?.find((t) => t.id === id)?.preview_url;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <Header brand right={<IconButton icon="settings-outline" label="Settings" onPress={props.onSettings} />} />
      <ScrollView contentContainerStyle={[s.column, s.scroll]}>
        {inst.show && (
          <View style={[s.row, { backgroundColor: C.goldSoft, borderRadius: 12, padding: 12, marginBottom: 18 }]}>
            <Ionicons name="phone-portrait-outline" size={22} color={C.gold} />
            <Text style={[s.small, { flex: 1, color: C.ink, marginHorizontal: 10 }]}>
              {inst.canPrompt
                ? 'Add Quick Invitations to your home screen.'
                : inst.isIOS
                  ? 'Add to your home screen: tap Share, then “Add to Home Screen”.'
                  : 'Add to your home screen: tap ⋮, then “Install app”.'}
            </Text>
            {inst.canPrompt && (
              <Pressable onPress={inst.install} hitSlop={8} accessibilityRole="button">
                <Text style={{ fontFamily: F.bold, color: C.maroon, fontSize: 14, paddingHorizontal: 6 }}>Install</Text>
              </Pressable>
            )}
            <IconButton icon="close" label="Dismiss" onPress={inst.dismiss} color={C.muted} />
          </View>
        )}

        <Text style={s.display}>Video invitations for every celebration</Text>
        <Text style={[s.muted, { marginTop: 8, marginBottom: 24 }]}>
          Choose a design, add the names and dates, and share the video on WhatsApp.
        </Text>

        {!configured && (
          <View style={[s.panel, { marginBottom: 20, borderColor: C.gold }]}>
            <Text style={[s.body, { fontFamily: F.semi }]}>Connect your Cloudinary account</Text>
            <Text style={[s.small, { marginTop: 4, marginBottom: 12 }]}>
              Videos are sent to your rendering PC through Cloudinary. Add the cloud name and upload preset first.
            </Text>
            <Button title="Open settings" variant="secondary" onPress={props.onSettings} />
          </View>
        )}

        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Text style={s.section}>Designs</Text>
          {templates && <Text style={s.small}>{templates.length === 1 ? '1 design' : `${templates.length} designs`}</Text>}
        </View>
        <TemplateGrid templates={templates} onPick={props.onPickTemplate} />

        {history.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[s.section, { marginBottom: 12 }]}>Your videos</Text>
            <View style={[s.panel, { padding: 0 }]}>
              {history.map((h, i) => (
                <Pressable
                  key={h.id}
                  onPress={() => props.onOpen(h)}
                  onLongPress={async () => {
                    if (await confirm('Remove from this list?', h.title, 'Remove')) props.onDelete(h);
                  }}
                  style={({ pressed }) => [
                    s.row,
                    {
                      padding: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: C.line,
                      backgroundColor: pressed ? C.bg : 'transparent',
                    },
                  ]}
                >
                  {thumb(h.template) ? (
                    <Image source={{ uri: thumb(h.template) }} style={{ width: 32, height: 56, borderRadius: 6 }} />
                  ) : (
                    <View style={{ width: 32, height: 56, borderRadius: 6, backgroundColor: C.goldSoft }} />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>
                      {h.title}
                    </Text>
                    <Text style={s.small}>
                      {new Date(h.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.faint} />
                </Pressable>
              ))}
            </View>
            <Text style={[s.small, { marginTop: 8 }]}>Press and hold a video to remove it from this list.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
