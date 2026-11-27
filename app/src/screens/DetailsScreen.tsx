import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, DesignChip, Header, IconButton, StepBar } from '../components';
import { CAPS_KEYS, EVENT_FIELDS, SAMPLE_EVENTS, SAMPLE_FIELDS, SECTIONS, emptyEvent } from '../fields';
import { notify } from '../platform/notify';
import { C, F, s } from '../theme';
import type { Fields, InviteEvent, TemplateInfo } from '../types';

function Field(props: { label: string; value: string; hint?: string; caps?: boolean; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        style={s.input}
        value={props.value}
        placeholder={props.hint}
        placeholderTextColor={C.faint}
        autoCapitalize={props.caps ? 'characters' : 'words'}
        onChangeText={props.onChange}
      />
    </View>
  );
}

export function DetailsScreen(props: {
  initialFields: Fields;
  initialEvents: InviteEvent[];
  design: TemplateInfo;
  onChangeDesign: (fields: Fields, events: InviteEvent[]) => void;
  onBack: () => void;
  onSubmit: (fields: Fields, events: InviteEvent[]) => void;
}) {
  const [fields, setFields] = useState<Fields>(props.initialFields);
  const [events, setEvents] = useState<InviteEvent[]>(props.initialEvents.length ? props.initialEvents : [emptyEvent()]);

  const setField = (k: string, v: string) => setFields((f) => ({ ...f, [k]: CAPS_KEYS.has(k) ? v.toUpperCase() : v }));
  const setEventField = (i: number, k: keyof InviteEvent, v: string, caps?: boolean) =>
    setEvents((list) => list.map((e, j) => (j === i ? { ...e, [k]: caps ? v.toUpperCase() : v } : e)));

  function submit() {
    if (!fields.groom_short && !fields.groom_name) {
      notify("Add the groom's name", "Fill in at least the groom's short name or full name.");
      return;
    }
    const filled = events.filter((e) => e.title || e.date || e.venue);
    if (!filled.length) {
      notify('Add an event', 'Each video needs at least one event with a date and venue.');
      return;
    }
    props.onSubmit(fields, filled);
  }

  return (
    <SafeAreaView style={s.screen}>
      <Header
        title="Details"
        onBack={props.onBack}
        right={
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => {
              setFields(SAMPLE_FIELDS);
              setEvents(SAMPLE_EVENTS);
            }}
          >
            <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.maroon, padding: 6 }}>Use example</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.column, s.scroll]} keyboardShouldPersistTaps="handled">
          <StepBar step={2} />
          <DesignChip design={props.design} onChange={() => props.onChangeDesign(fields, events)} />
          <Text style={[s.small, { marginBottom: 18 }]}>Leave a box empty to leave that line out. Long lines shrink to fit.</Text>

          {SECTIONS.map((sec) => (
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

          <Text style={[s.section, { marginTop: 6 }]}>Events</Text>
          <Text style={[s.small, { marginTop: 2, marginBottom: 12 }]}>Each event gets its own card in the video.</Text>
          {events.map((ev, i) => (
            <View key={i} style={[s.panel, { paddingBottom: 4, marginBottom: 12 }]}>
              <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8, marginTop: -6 }]}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.maroon }}>Event {i + 1}</Text>
                {events.length > 1 && (
                  <IconButton
                    icon="trash-outline"
                    label={`Remove event ${i + 1}`}
                    color={C.muted}
                    onPress={() => setEvents((l) => l.filter((_, j) => j !== i))}
                  />
                )}
              </View>
              {EVENT_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={ev[f.key]}
                  hint={f.hint}
                  caps={f.caps}
                  onChange={(v) => setEventField(i, f.key, v, f.caps)}
                />
              ))}
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setEvents((l) => [...l, emptyEvent()])}
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
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={s.footer}>
          <View style={s.column}>
            <Button title="Create video" icon="sparkles-outline" onPress={submit} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
