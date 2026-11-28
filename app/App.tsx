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
import { BUNDLED_CATEGORIES, getCatalog, getConfig, getMe } from './src/api';
import { inviteTitle, startFields } from './src/fields';
import { AccountScreen } from './src/screens/AccountScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { CardScreen } from './src/screens/CardScreen';
import { DesignScreen } from './src/screens/DesignScreen';
import { DetailsScreen } from './src/screens/DetailsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProgressScreen, type Request } from './src/screens/ProgressScreen';
import { ResultScreen } from './src/screens/ResultScreen';
import { TemplateScreen } from './src/screens/TemplateScreen';
import { addHistory, getAdminToken, getShopToken, loadHistory, removeHistory, setShopToken } from './src/storage';
import { C } from './src/theme';
import type { AppConfig, Category, Fields, HistoryItem, InviteEvent, MusicChoice, MusicTrack, ShopUser, TemplateInfo } from './src/types';

// A small screen switch; the app has a handful of screens, so no navigation library is needed.
type Route =
  | { name: 'home' }
  | { name: 'account' }
  | { name: 'admin' }
  | { name: 'template'; design: TemplateInfo }
  | { name: 'change'; design: TemplateInfo; fields: Fields; events: InviteEvent[]; music?: MusicChoice }
  | { name: 'card'; design: TemplateInfo }
  | { name: 'details'; design: TemplateInfo; fields: Fields; events: InviteEvent[]; music?: MusicChoice }
  | { name: 'progress'; design: TemplateInfo; request: Request }
  | { name: 'result'; item: HistoryItem };

export default function App() {
  const [fontsLoaded] = useFonts({
    Marcellus_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    ...Ionicons.font,
  });
  const [categories, setCategories] = useState<Category[]>(BUNDLED_CATEGORIES);
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [category, setCategory] = useState('marriage');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [shop, setShop] = useState<ShopUser | null>(null);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [route, setRoute] = useState<Route>({ name: 'home' });

  const refreshShop = useCallback(async () => {
    if (!(await getShopToken())) return setShop(null);
    try {
      setShop(await getMe());
    } catch (e) {
      // expired or removed account: sign out; a network error keeps the saved sign-in
      if (/signed in|401/i.test(String(e))) {
        await setShopToken(null);
        setShop(null);
      }
    }
  }, []);

  useEffect(() => {
    getCatalog().then((c) => {
      setCategories(c.categories);
      setTemplates(c.templates);
      setTracks(c.music);
    });
    getConfig().then(setConfig).catch(() => {});
    loadHistory().then(setHistory);
    refreshShop();
    getAdminToken().then((t) => setHasAdmin(!!t));
  }, [refreshShop]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.maroon} />
      </View>
    );
  }

  const home = () => setRoute({ name: 'home' });
  const catOf = (design?: TemplateInfo, id?: string): Category =>
    categories.find((c) => c.id === (id ?? design?.category ?? 'marriage')) ?? categories[0];
  const designById = (id?: string): TemplateInfo => templates?.find((t) => t.id === id) ?? { id: id ?? '', title: 'Design' };

  let screen: React.ReactNode;
  switch (route.name) {
    case 'home':
      screen = (
        <HomeScreen
          categories={categories}
          templates={templates}
          category={category}
          onCategory={setCategory}
          history={history}
          config={config}
          shop={shop}
          onPickTemplate={(design) => setRoute({ name: 'template', design })}
          onOpen={(item) => setRoute({ name: 'result', item })}
          onDelete={async (item) => setHistory(await removeHistory(item.id))}
          onAccount={() => {
            refreshShop();
            setRoute({ name: 'account' });
          }}
        />
      );
      break;
    case 'account':
      screen = (
        <AccountScreen
          shop={shop}
          hasAdmin={hasAdmin}
          config={config}
          onBack={home}
          onShop={setShop}
          onAdmin={() => {
            setHasAdmin(true);
            setRoute({ name: 'admin' });
          }}
        />
      );
      break;
    case 'admin':
      screen = (
        <AdminScreen
          onBack={() => setRoute({ name: 'account' })}
          onSignedOut={() => {
            setHasAdmin(false);
            setRoute({ name: 'account' });
          }}
        />
      );
      break;
    case 'template': {
      const design = route.design;
      const cat = catOf(design);
      screen = (
        <TemplateScreen
          design={design}
          category={cat}
          onBack={home}
          onType={() => setRoute({ name: 'details', design, fields: startFields(cat), events: [] })}
          onScan={() => setRoute({ name: 'card', design })}
        />
      );
      break;
    }
    case 'change': {
      const r = route;
      const cat = catOf(r.design);
      screen = (
        <DesignScreen
          templates={templates?.filter((t) => (t.category ?? 'marriage') === cat.id) ?? null}
          selected={r.design.id}
          onBack={() => setRoute({ name: 'details', design: r.design, fields: r.fields, events: r.events, music: r.music })}
          onPick={(design) => setRoute({ name: 'details', design, fields: r.fields, events: r.events, music: r.music })}
        />
      );
      break;
    }
    case 'card': {
      const design = route.design;
      const cat = catOf(design);
      screen = (
        <CardScreen
          design={design}
          tracks={tracks}
          onBack={() => setRoute({ name: 'template', design })}
          onMake={(card, quality, music) =>
            setRoute({ name: 'progress', design, request: { kind: 'card', category: cat.id, template: design.id, card, quality, music } })
          }
        />
      );
      break;
    }
    case 'details': {
      const design = route.design;
      const cat = catOf(design);
      screen = (
        <DetailsScreen
          key={design.id}
          category={cat}
          design={design}
          initialFields={route.fields}
          initialEvents={route.events}
          initialMusic={route.music}
          tracks={tracks}
          onChangeDesign={(fields, events, music) => setRoute({ name: 'change', design, fields, events, music })}
          onBack={() => setRoute({ name: 'template', design })}
          onSubmit={(fields, events, music) =>
            setRoute({ name: 'progress', design, request: { kind: 'details', category: cat.id, template: design.id, fields, events, music } })
          }
        />
      );
      break;
    }
    case 'progress': {
      const { request, design } = route;
      const cat = catOf(design, request.category);
      const toItem = (id: string, fields: Fields, events: InviteEvent[]): HistoryItem => ({
        id,
        category: cat.id,
        template: design.id,
        title: inviteTitle(cat, fields, events),
        createdAt: Date.now(),
        fields,
        events,
        fromCard: request.kind === 'card',
        music: request.music.kind === 'upload' ? { kind: 'design' } : request.music,
      });
      screen = (
        <ProgressScreen
          design={design}
          request={request}
          onHome={home}
          onCancel={() =>
            request.kind === 'details'
              ? setRoute({ name: 'details', design, fields: request.fields, events: request.events, music: request.music })
              : setRoute({ name: 'card', design })
          }
          onCreated={async (order) => {
            // saved straight away, so the video is under "Your videos" even if the person leaves this screen
            const item =
              request.kind === 'details'
                ? toItem(order.id, request.fields, request.events)
                : { ...toItem(order.id, startFields(cat), []), title: `${cat.title} (from card)` };
            setHistory(await addHistory(item));
          }}
          onDone={async (order) => {
            let item: HistoryItem;
            if (request.kind === 'details') item = toItem(order.id, request.fields, request.events);
            else {
              const fields = { ...startFields(cat), ...(order.extracted?.fields ?? {}) };
              item = toItem(order.id, fields, order.extracted?.events ?? []);
            }
            setHistory(await addHistory(item));
            setRoute({ name: 'result', item });
          }}
        />
      );
      break;
    }
    case 'result': {
      const item = route.item;
      screen = (
        <ResultScreen
          key={item.id}
          item={item}
          config={config}
          onHome={home}
          onEdit={() => setRoute({ name: 'details', design: { category: item.category, ...designById(item.template) }, fields: item.fields, events: item.events, music: item.music })}
        />
      );
      break;
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>{screen}</View>
    </SafeAreaProvider>
  );
}
