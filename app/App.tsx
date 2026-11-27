import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Marcellus_400Regular } from '@expo-google-fonts/marcellus/400Regular';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fetchTemplates } from './src/cloudinary';
import { DEFAULT_FIELDS, inviteTitle } from './src/fields';
import { CardScreen } from './src/screens/CardScreen';
import { DesignScreen } from './src/screens/DesignScreen';
import { DetailsScreen } from './src/screens/DetailsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProgressScreen, type Request } from './src/screens/ProgressScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TemplateScreen } from './src/screens/TemplateScreen';
import { addHistory, loadHistory, loadSettings, removeHistory, saveSettings } from './src/storage';
import { C } from './src/theme';
import type { Fields, HistoryItem, InviteEvent, Settings, TemplateInfo } from './src/types';

// A small screen switch; the app has a handful of screens, so no navigation library is needed.
type Route =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'template'; design: TemplateInfo }
  | { name: 'change'; fields: Fields; events: InviteEvent[]; selected?: string }
  | { name: 'card'; design: TemplateInfo }
  | { name: 'details'; design: TemplateInfo; fields: Fields; events: InviteEvent[] }
  | { name: 'progress'; design: TemplateInfo; request: Request }
  | { name: 'result'; item: HistoryItem; fromCard: boolean };

export default function App() {
  const [fontsLoaded] = useFonts({
    Marcellus_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    ...Ionicons.font,
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'home' });

  const refreshTemplates = useCallback((st: Settings) => {
    fetchTemplates(st).then(setTemplates);
  }, []);

  useEffect(() => {
    loadSettings().then((st) => {
      setSettings(st);
      refreshTemplates(st);
    });
    loadHistory().then(setHistory);
  }, [refreshTemplates]);

  if (!settings || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.maroon} />
      </View>
    );
  }

  const configured = !!settings.cloudName && !!settings.uploadPreset;
  const home = () => setRoute({ name: 'home' });
  const designById = (id?: string): TemplateInfo =>
    templates?.find((t) => t.id === id) ?? { id: id || settings.template, title: 'Design' };

  let screen: React.ReactNode;
  switch (route.name) {
    case 'home':
      screen = (
        <HomeScreen
          templates={templates}
          history={history}
          configured={configured}
          onPickTemplate={(design) => setRoute({ name: 'template', design })}
          onOpen={(item) => setRoute({ name: 'result', item, fromCard: false })}
          onDelete={async (item) => setHistory(await removeHistory(item.id))}
          onSettings={() => setRoute({ name: 'settings' })}
        />
      );
      break;
    case 'settings':
      screen = (
        <SettingsScreen
          settings={settings}
          onBack={home}
          onSave={async (next) => {
            await saveSettings(next);
            setSettings(next);
            refreshTemplates(next);
          }}
        />
      );
      break;
    case 'template': {
      const design = route.design;
      screen = (
        <TemplateScreen
          design={design}
          onBack={home}
          onType={() => setRoute({ name: 'details', design, fields: { ...DEFAULT_FIELDS }, events: [] })}
          onScan={() => setRoute({ name: 'card', design })}
        />
      );
      break;
    }
    case 'change': {
      const r = route;
      screen = (
        <DesignScreen
          templates={templates}
          selected={r.selected}
          onBack={() => setRoute({ name: 'details', design: designById(r.selected), fields: r.fields, events: r.events })}
          onPick={(design) => setRoute({ name: 'details', design, fields: r.fields, events: r.events })}
        />
      );
      break;
    }
    case 'card': {
      const design = route.design;
      screen = (
        <CardScreen
          design={design}
          onBack={() => setRoute({ name: 'template', design })}
          onMake={(card) => setRoute({ name: 'progress', design, request: { kind: 'card', template: design.id, card } })}
        />
      );
      break;
    }
    case 'details': {
      const design = route.design;
      screen = (
        <DetailsScreen
          key={design.id}
          design={design}
          initialFields={route.fields}
          initialEvents={route.events}
          onChangeDesign={(fields, events) => setRoute({ name: 'change', fields, events, selected: design.id })}
          onBack={() => setRoute({ name: 'template', design })}
          onSubmit={(fields, events) =>
            setRoute({ name: 'progress', design, request: { kind: 'details', template: design.id, fields, events } })
          }
        />
      );
      break;
    }
    case 'progress': {
      const { request, design } = route;
      screen = (
        <ProgressScreen
          settings={settings}
          design={design}
          request={request}
          onCancel={() =>
            request.kind === 'details'
              ? setRoute({ name: 'details', design, fields: request.fields, events: request.events })
              : setRoute({ name: 'card', design })
          }
          onDone={async (job, result) => {
            const fromCard = request.kind === 'card';
            const fields = fromCard ? { ...DEFAULT_FIELDS, ...(result.extracted_from_card?.fields ?? {}) } : request.fields;
            const events = fromCard ? result.extracted_from_card?.events ?? [] : request.events;
            const item: HistoryItem = {
              id: job.id,
              template: job.template,
              title: inviteTitle(fields, events),
              videoUrl: result.video_url ?? '',
              createdAt: Date.now(),
              fields,
              events,
            };
            setHistory(await addHistory(item));
            setRoute({ name: 'result', item, fromCard });
          }}
        />
      );
      break;
    }
    case 'result':
      screen = (
        <ResultScreen
          key={route.item.id}
          item={route.item}
          fromCard={route.fromCard}
          onHome={home}
          onEdit={() =>
            setRoute({ name: 'details', design: designById(route.item.template), fields: route.item.fields, events: route.item.events })
          }
        />
      );
      break;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>{screen}</View>
    </SafeAreaProvider>
  );
}
