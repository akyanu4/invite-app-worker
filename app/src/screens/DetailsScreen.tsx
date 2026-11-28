import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, DesignChip, Field, Header, IconButton, StepBar } from '../components';
import { capsKeys, emptyEvent, mainNameKey } from '../fields';
import { MusicPicker } from '../MusicPicker';
import { notify } from '../platform/notify';
import { C, F, s } from '../theme';
import type { Category, Fields, InviteEvent, MusicChoice, MusicTrack, TemplateInfo } from '../types';

export function DetailsScreen(props: {
  category: Category;
  initialFields: Fields;
  initialEvents: InviteEvent[];
  design: TemplateInfo;
  tracks: MusicTrack[];
  initialMusic?: MusicChoice;
  onChangeDesign: (fields: Fields, events: InviteEvent[], music: MusicChoice) => void;
  onBack: () => void;
  onSubmit: (fields: Fields, events: InviteEvent[], music: MusicChoice) => void;
}) {
  const cat = props.category;
  const caps = useMemo(() => capsKeys(cat), [cat]);
  const [fields, setFields] = useState<Fields>(props.initialFields);
  const [events, setEvents] = useState<InviteEvent[]>(props.initialEvents.length ? props.initialEvents : [emptyEvent(cat)]);
  const [music, setMusic] = useState<MusicChoice>(props.initialMusic ?? { kind: 'design' });

  const setField = (k: string, v: string) => setFields((f) => ({ ...f, [k]: caps.has(k) ? v.toUpperCase() : v }));
  const setEventField = (i: number, k: string, v: string, up?: boolean) =>
    setEvents((list) => list.map((e, j) => (j === i ? { ...e, [k]: up ? v.toUpperCase() : v } : e)));

  function submit() {
    const nameKeys = cat.title_fields ?? [];
    if (nameKeys.length && !nameKeys.some((k) => fields[k]?.trim())) {
      const key = mainNameKey(cat);
      const label = cat.sections.flatMap((sec) => sec.fields).find((f) => f.key === key)?.label ?? 'name';
      notify(`Add the ${label.toLowerCase()}`, 'The video needs at least this name.');
      return;
    }
    const filled = events.filter((e) => e.title || e.date || e.venue);
    if (!filled.length) {
      notify('Add the date and venue', 'Each video needs at least one event with a date and venue.');
      return;
    }
    props.onSubmit(fields, filled, music);
  }

  return (
    <SafeAreaView style={s.screen}>
      <Header
        title={`${cat.title} details`}
        onBack={props.onBack}
        right={
          cat.sample ? (
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              onPress={() => {
                setFields({ ...(cat.defaults ?? {}), ...cat.sample!.fields });
                setEvents(cat.sample!.events.map((e) => ({ ...e })));
              }}
            >
              <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.maroon, padding: 6 }}>Use example</Text>
            </Pressable>
          ) : undefined
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.column, s.scroll]} keyboardShouldPersistTaps="handled">
          <StepBar step={2} />
          <DesignChip design={props.design} onChange={() => props.onChangeDesign(fields, events, music)} />
          <Text style={[s.small, { marginBottom: 18 }]}>Leave a box empty to leave that line out. Long lines shrink to fit.</Text>

          {cat.sections.map((sec) => (
            <View key={sec.title} style={{ marginBottom: 10 }}>
              <Text style={[s.section, { marginBottom: 12 }]}>{sec.title}</Text>
              <View style={[s.panel, { paddingBottom: 4 }]}>
                {sec.fields.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    value={fields[f.key] ?? ''}
                    hint={f.hint}
                    caps={f.caps}
                    onChange={(v) => setField(f.key, v)}
                  />
                ))}
              </View>
            </View>
          ))}

          <Text style={[s.section, { marginTop: 6 }]}>{cat.events.title}</Text>
          {!!cat.events.help && <Text style={[s.small, { marginTop: 2, marginBottom: 12 }]}>{cat.events.help}</Text>}
          {events.map((ev, i) => (
            <View key={i} style={[s.panel, { paddingBottom: 4, marginBottom: 12 }]}>
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8, marginTop: -6 }]}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.maroon }}>
                  {events.length > 1 ? `Event ${i + 1}` : 'Event'}
                </Text>
                {events.length > 1 && (
                  <IconButton
                    icon="trash-outline"
                    label={`Remove event ${i + 1}`}
                    color={C.muted}
                    onPress={() => setEvents((l) => l.filter((_, j) => j !== i))}
                  />
                )}
              </View>
              {cat.events.fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={ev[f.key] ?? ''}
                  hint={f.hint}
                  caps={f.caps}
                  onChange={(v) => setEventField(i, f.key, v, f.caps)}
                />
              ))}
            </View>
          ))}
          {events.length < 6 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setEvents((l) => [...l, emptyEvent(cat)])}
              style={({ pressed }) => [
                s.row,
                {
                  justifyContent: 'center',
                  height: 48,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: C.gold,
                  backgroundColor: pressed ? C.goldSoft : 'transparent',
                },
              ]}
            >
              <Ionicons name="add" size={20} color={C.maroon} />
              <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.maroon, marginLeft: 6 }}>Add another event</Text>
            </Pressable>
          )}
          <View style={{ marginTop: 26 }}>
            <MusicPicker tracks={props.tracks} designMusic={props.design.music_title} value={music} onChange={setMusic} />
          </View>
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={s.footer}>
          <View style={s.column}>
            <Button title="Create free preview" icon="sparkles-outline" onPress={submit} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
