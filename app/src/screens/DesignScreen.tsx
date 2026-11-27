import React from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components';
import { TemplateGrid } from '../TemplateGrid';
import { s } from '../theme';
import type { TemplateInfo } from '../types';

/** Switch design while keeping the details already typed. */
export function DesignScreen(props: {
  templates: TemplateInfo[] | null;
  selected?: string;
  onBack: () => void;
  onPick: (t: TemplateInfo) => void;
}) {
  return (
    <SafeAreaView style={s.screen}>
      <Header title="Change design" onBack={props.onBack} />
      <ScrollView contentContainerStyle={[s.column, s.scroll]}>
        <Text style={[s.muted, { marginBottom: 16 }]}>Your details stay the same. Tap a design to use it.</Text>
        <TemplateGrid templates={props.templates} selected={props.selected} onPick={props.onPick} />
      </ScrollView>
    </SafeAreaView>
  );
}
