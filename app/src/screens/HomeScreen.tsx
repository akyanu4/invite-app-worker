import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Header, IconButton, type IconName } from '../components';
import { useInstallPrompt } from '../platform/install';
import { confirm } from '../platform/notify';
import { TemplateGrid } from '../TemplateGrid';
import { C, F, s } from '../theme';
import type { AppConfig, Category, HistoryItem, ShopUser, TemplateInfo } from '../types';

type Sort = 'featured' | 'az';

export function HomeScreen(props: {
  categories: Category[];
  templates: TemplateInfo[] | null;
  category: string;
  onCategory: (id: string) => void;
  history: HistoryItem[];
  config: AppConfig | null;
  shop: ShopUser | null;
  onPickTemplate: (t: TemplateInfo) => void;
  onOpen: (item: HistoryItem) => void;
  onDelete: (item: HistoryItem) => void;
  onAccount: () => void;
}) {
  const { history, templates, categories, category, config, shop } = props;
  const inst = useInstallPrompt();
  const [tag, setTag] = useState<string>('');
  const [sort, setSort] = useState<Sort>('featured');
  const cat = categories.find((c) => c.id === category) ?? categories[0];
  const thumb = (id?: string) => templates?.find((t) => t.id === id)?.preview_url;

  const inCategory = useMemo(
    () => (templates ? templates.filter((t) => (t.category ?? 'marriage') === cat?.id) : null),
    [templates, cat?.id]
  );
  const tags = useMemo(() => [...new Set((inCategory ?? []).flatMap((t) => t.tags ?? []))].sort(), [inCategory]);
  const shown = useMemo(() => {
    if (!inCategory) return null;
    const list = tag ? inCategory.filter((t) => t.tags?.includes(tag)) : [...inCategory];
    return list.sort((a, b) => (sort === 'az' ? a.title.localeCompare(b.title) : (a.order ?? 100) - (b.order ?? 100)));
  }, [inCategory, tag, sort]);

  const shopPrice = shop?.status === 'approved';
  const price = config ? (shopPrice ? config.prices.shop : config.prices.customer) : null;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <Header
        brand
        right={<IconButton icon={shop ? 'storefront-outline' : 'person-circle-outline'} label="Account" onPress={props.onAccount} />}
      />
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
        <Text style={[s.muted, { marginTop: 8, marginBottom: 20 }]}>
          Pick the occasion and a design, add the details, and share the video on WhatsApp.
          {price != null ? ` Preview free, ₹${price} to download${shopPrice ? ' (shop price)' : ''}.` : ''}
        </Text>

        {/* occasions */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 18 }}>
          {categories.map((c) => {
            const on = c.id === cat?.id;
            return (
              <View key={c.id} style={{ width: '50%', padding: 5 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setTag('');
                    props.onCategory(c.id);
                  }}
                  style={({ pressed }) => ({
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: on ? C.maroon : C.line,
                    backgroundColor: on ? C.maroon : pressed ? C.line : C.surface,
                  })}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? 'rgba(255,255,255,0.14)' : C.goldSoft,
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name={(c.icon ?? 'sparkles-outline') as IconName} size={19} color={on ? '#E9CF96' : C.gold} />
                  </View>
                  <View>
                    <Text numberOfLines={1} style={{ fontFamily: F.semi, fontSize: 15, color: on ? '#fff' : C.ink }}>
                      {c.title}
                    </Text>
                    {!!c.subtitle && (
                      <Text numberOfLines={1} style={{ fontFamily: F.body, fontSize: 12, color: on ? '#EBD9DB' : C.muted }}>
                        {c.subtitle}
                      </Text>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
          <Text style={s.section}>{cat ? `${cat.title} designs` : 'Designs'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sort === 'az' ? 'Sorted A to Z. Sort by featured' : 'Sorted by featured. Sort A to Z'}
            onPress={() => setSort(sort === 'az' ? 'featured' : 'az')}
            hitSlop={8}
            style={s.row}
          >
            <Ionicons name="swap-vertical" size={16} color={C.maroon} />
            <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.maroon, marginLeft: 4 }}>
              {sort === 'az' ? 'A–Z' : 'Featured'}
            </Text>
          </Pressable>
        </View>
        {tags.length > 1 && (inCategory?.length ?? 0) > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ paddingRight: 8 }}>
            <Chip label="All styles" on={!tag} onPress={() => setTag('')} />
            {tags.map((t) => (
              <Chip key={t} label={t} on={tag === t} onPress={() => setTag(tag === t ? '' : t)} />
            ))}
          </ScrollView>
        )}
        {shown && shown.length === 0 ? (
          <View style={[s.panel, { alignItems: 'center', paddingVertical: 28, marginBottom: 16 }]}>
            <Ionicons name="color-palette-outline" size={28} color={C.gold} />
            <Text style={[s.body, { fontFamily: F.semi, marginTop: 8 }]}>No {cat?.title.toLowerCase()} designs yet</Text>
            <Text style={[s.small, { marginTop: 2, textAlign: 'center' }]}>New designs appear here as soon as they are added.</Text>
          </View>
        ) : (
          <TemplateGrid templates={shown} onPick={props.onPickTemplate} />
        )}

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
                    { padding: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.line, backgroundColor: pressed ? C.bg : 'transparent' },
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
                      {categories.find((c) => c.id === h.category)?.title ?? ''} ·{' '}
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
