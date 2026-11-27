import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DEFAULT_FIELDS, inviteTitle } from './src/fields';
import { CardScreen } from './src/screens/CardScreen';
import { DesignScreen } from './src/screens/DesignScreen';
import { DetailsScreen } from './src/screens/DetailsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProgressScreen, type Request } from './src/screens/ProgressScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { addHistory, loadHistory, loadSettings, removeHistory, saveSettings } from './src/storage';
import { C } from './src/theme';
import type { Fields, HistoryItem, InviteEvent, Settings, TemplateInfo } from './src/types';

// A tiny screen stack: the app has seven screens, so no navigation library is needed.
type Route =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'design'; next: 'card' | 'details'; fields?: Fields; events?: InviteEvent[]; selected?: string }
  | { name: 'card'; design: TemplateInfo }
  | { name: 'details'; fields: Fields; events: InviteEvent[]; design: TemplateInfo }
  | { name: 'progress'; request: Request }
  | { name: 'result'; item: HistoryItem; fromCard: boolean };

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'home' });

  useEffect(() => {
    loadSettings().then(setSettings);
    loadHistory().then(setHistory);
  }, []);

  if (!settings) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  const configured = !!settings.cloudName && !!settings.uploadPreset;
  const home = () => setRoute({ name: 'home' });

  let screen: React.ReactNode;
  switch (route.name) {
    case 'home':
      screen = (
        <HomeScreen
          history={history}
          configured={configured}
          onScanCard={() => setRoute({ name: 'design', next: 'card' })}
          onTypeDetails={() => setRoute({ name: 'design', next: 'details' })}
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
          }}
        />
      );
      break;
    case 'design': {
      const r = route;
      screen = (
        <DesignScreen
          settings={settings}
          selected={r.selected}
          onBack={home}
          onPick={(design) =>
            r.next === 'card'
              ? setRoute({ name: 'card', design })
              : setRoute({
                  name: 'details',
                  design,
                  fields: r.fields ?? { ...DEFAULT_FIELDS },
                  events: r.events ?? [],
                })
          }
        />
      );
      break;
    }
    case 'card': {
      const design = route.design;
      screen = (
        <CardScreen
          designTitle={design.title}
          onBack={home}
          onMake={(card) => setRoute({ name: 'progress', request: { kind: 'card', template: design.id, card } })}
        />
      );
      break;
    }
    case 'details': {
      const design = route.design;
      screen = (
        <DetailsScreen
          key={design.id}
          initialFields={route.fields}
          initialEvents={route.events}
          designTitle={design.title}
          onChangeDesign={(fields, events) =>
            setRoute({ name: 'design', next: 'details', fields, events, selected: design.id })
          }
          onBack={home}
          onSubmit={(fields, events) =>
            setRoute({ name: 'progress', request: { kind: 'details', template: design.id, fields, events } })
          }
        />
      );
      break;
    }
    case 'progress': {
      const request = route.request;
      screen = (
        <ProgressScreen
          settings={settings}
          request={request}
          onCancel={home}
          onDone={async (job, result) => {
            const fromCard = request.kind === 'card';
            const fields = fromCard
              ? { ...DEFAULT_FIELDS, ...(result.extracted_from_card?.fields ?? {}) }
              : request.fields;
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
            setRoute({
              name: 'design',
              next: 'details',
              fields: route.item.fields,
              events: route.item.events,
              selected: route.item.template,
            })
          }
        />
      );
      break;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen}
    </SafeAreaProvider>
  );
}
