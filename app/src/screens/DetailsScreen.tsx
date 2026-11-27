import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { CAPS_KEYS, EVENT_FIELDS, SAMPLE_EVENTS, SAMPLE_FIELDS, SECTIONS, emptyEvent } from '../fields';
import { notify } from '../platform/notify';
import { C, s } from '../theme';
import type { Fields, InviteEvent } from '../types';

export function DetailsScreen(props: {
  initialFields: Fields;
  initialEvents: InviteEvent[];
  designTitle: string;
  onChangeDesign: (fields: Fields, events: InviteEvent[]) => void;
  onBack: () => void;
  onSubmit: (fields: Fields, events: InviteEvent[]) => void;
}) {
  const [fields, setFields] = useState<Fields>(props.initialFields);
  const [events, setEvents] = useState<InviteEvent[]>(
    props.initialEvents.length ? props.initialEvents : [emptyEvent()]
  );

  const setField = (k: string, v: string) => setFields((f) => ({ ...f, [k]: CAPS_KEYS.has(k) ? v.toUpperCase() : v }));
  const setEventField = (i: number, k: keyof InviteEvent, v: string, caps?: boolean) =>
    setEvents((list) => list.map((e, j) => (j === i ? { ...e, [k]: caps ? v.toUpperCase() : v } : e)));

  function submit() {
    if (!fields.groom_short && !fields.groom_name) {
      notify('Missing name', "Enter at least the groom's name.");
      return;
    }
    const filled = events.filter((e) => e.title || e.date || e.venue);
    if (!filled.length) {
      notify('Missing event', 'Add at least one event with a date and venue.');
      return;
    }
    props.onSubmit(fields, filled);
  }

  return (
    <SafeAreaView style={s.screen}>
      <TopBar
        title="Invitation details"
        onBack={props.onBack}
        right={
          <Pressable
            hitSlop={10}
            onPress={() => {
              setFields(SAMPLE_FIELDS);
              setEvents(SAMPLE_EVENTS);
            }}
          >
            <Text style={[s.link, { fontSize: 14 }]}>Example</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={[s.card, s.row, { justifyContent: 'space-between', backgroundColor: C.goldLight }]}>
            <Text style={{ color: C.text }}>
              Design: <Text style={{ fontWeight: '700' }}>{props.designTitle}</Text>
            </Text>
            <Pressable hitSlop={10} onPress={() => props.onChangeDesign(fields, events)}>
              <Text style={[s.link, { fontSize: 14 }]}>Change</Text>
            </Pressable>
          </View>
          <Text style={s.p}>Leave a box empty to leave that line out. Long lines shrink to fit automatically.</Text>

          {SECTIONS.map((sec) => (
            <View key={sec.title}>
              <Text style={s.h2}>{sec.title}</Text>
              <View style={s.card}>
                {sec.fields.map((f) => (
                  <View key={f.key}>
                    <Text style={s.label}>{f.label}</Text>
                    <TextInput
                      style={s.input}
                      value={fields[f.key] ?? ''}
                      placeholder={f.hint}
                      placeholderTextColor="#B5AB9C"
                      autoCapitalize={f.caps ? 'characters' : 'words'}
                      onChangeText={(v) => setField(f.key, v)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}

          <Text style={s.h2}>Events (one card each)</Text>
          {events.map((ev, i) => (
            <View key={i} style={s.card}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={{ fontWeight: '700', color: C.goldDark }}>Event {i + 1}</Text>
                {events.length > 1 && (
                  <Pressable hitSlop={10} onPress={() => setEvents((l) => l.filter((_, j) => j !== i))}>
                    <Text style={{ color: C.danger }}>Remove</Text>
                  </Pressable>
                )}
              </View>
              {EVENT_FIELDS.map((f) => (
                <View key={f.key}>
                  <Text style={s.label}>{f.label}</Text>
                  <TextInput
                    style={s.input}
                    value={ev[f.key]}
                    placeholder={f.hint}
                    placeholderTextColor="#B5AB9C"
                    autoCapitalize={f.caps ? 'characters' : 'words'}
                    onChangeText={(v) => setEventField(i, f.key, v, f.caps)}
                  />
                </View>
              ))}
            </View>
          ))}
          <Button title="+ Add another event" ghost onPress={() => setEvents((l) => [...l, emptyEvent()])} />

          <Button title="Make the video" onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
