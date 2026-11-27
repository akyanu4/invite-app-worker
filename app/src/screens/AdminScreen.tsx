import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminPayment, adminPromoActive, adminSavePromo, adminShop, adminSummary, type AdminSummary } from '../api';
import { Badge, Button, Chip, Field, Header, IconButton } from '../components';
import { confirm, notify } from '../platform/notify';
import { setAdminToken } from '../storage';
import { C, F, s } from '../theme';
import type { Order } from '../types';

type Tab = 'payments' | 'shops' | 'promos' | 'orders';

const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

function Row(props: { children: React.ReactNode; first?: boolean }) {
  return <View style={{ paddingVertical: 12, borderTopWidth: props.first ? 0 : 1, borderTopColor: C.line }}>{props.children}</View>;
}

function payTone(o: Order) {
  return o.pay_status === 'paid' ? 'green' : o.pay_status === 'submitted' ? 'gold' : o.pay_status === 'rejected' ? 'red' : 'grey';
}

export function AdminScreen(props: { onBack: () => void; onSignedOut: () => void }) {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [tab, setTab] = useState<Tab>('payments');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('100');
  const [maxUses, setMaxUses] = useState('');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminSummary());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/sign-in|401/i.test(msg)) {
        await setAdminToken(null);
        props.onSignedOut();
        return;
      }
      notify('Couldn’t load', msg);
    } finally {
      setLoading(false);
    }
  }, [props]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>) {
    try {
      setBusy(key);
      await fn();
      await load();
    } catch (e) {
      notify('Not saved', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  const pendingShops = data?.shops.filter((u) => u.status === 'pending').length ?? 0;

  return (
    <SafeAreaView style={s.screen}>
      <Header
        title="Admin"
        onBack={props.onBack}
        right={
          <IconButton
            icon="log-out-outline"
            label="Sign out of admin"
            onPress={async () => {
              await setAdminToken(null);
              props.onSignedOut();
            }}
          />
        }
      />
      <View style={[s.column, { paddingHorizontal: 20 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
          <Chip label={`Payments${data?.payments.length ? ` (${data.payments.length})` : ''}`} on={tab === 'payments'} onPress={() => setTab('payments')} />
          <Chip label={`Shops${pendingShops ? ` (${pendingShops})` : ''}`} on={tab === 'shops'} onPress={() => setTab('shops')} />
          <Chip label="Promo codes" on={tab === 'promos'} onPress={() => setTab('promos')} />
          <Chip label="Recent videos" on={tab === 'orders'} onPress={() => setTab('orders')} />
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={[s.column, s.scroll, { paddingTop: 0 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        {!data ? (
          <ActivityIndicator color={C.maroon} style={{ marginTop: 40 }} />
        ) : tab === 'payments' ? (
          <>
            <Text style={[s.small, { marginBottom: 10 }]}>
              Check each transaction ID in your bank or UPI app, then approve it. Approving unlocks the video for the customer.
            </Text>
            <View style={[s.panel, { paddingVertical: 0 }]}>
              {data.payments.length === 0 && <Text style={[s.muted, { paddingVertical: 16 }]}>No payments waiting.</Text>}
              {data.payments.map((o, i) => (
                <Row key={o.id} first={i === 0}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={{ fontFamily: F.display, fontSize: 22, color: C.maroon }}>₹{o.price}</Text>
                    <Text style={s.small}>{when(o.created_at)}</Text>
                  </View>
                  <Text style={[s.body, { marginTop: 2 }]} selectable>
                    UTR <Text style={{ fontFamily: F.bold }}>{o.utr}</Text>
                  </Text>
                  <Text style={s.small}>
                    {o.category} · {o.template} · {o.id.slice(-8)}
                    {o.user_id ? ' · shop' : ''}
                  </Text>
                  {!!o.preview_url && (
                    <Pressable onPress={() => Linking.openURL(o.preview_url!)} hitSlop={6}>
                      <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.maroon, marginTop: 4 }}>Watch preview</Text>
                    </Pressable>
                  )}
                  <View style={[s.row, { marginTop: 10 }]}>
                    <Button
                      title="Approve"
                      icon="checkmark"
                      busy={busy === `ok-${o.id}`}
                      disabled={!!busy}
                      onPress={() => act(`ok-${o.id}`, () => adminPayment(o.id, true))}
                      style={{ flex: 1, marginRight: 10, height: 44 }}
                    />
                    <Button
                      title="Not received"
                      variant="secondary"
                      busy={busy === `no-${o.id}`}
                      disabled={!!busy}
                      onPress={async () => {
                        if (await confirm('Mark as not received?', 'The customer is asked to check the transaction ID and try again.', 'Mark not received'))
                          act(`no-${o.id}`, () => adminPayment(o.id, false));
                      }}
                      style={{ flex: 1, height: 44 }}
                    />
                  </View>
                </Row>
              ))}
            </View>
          </>
        ) : tab === 'shops' ? (
          <View style={[s.panel, { paddingVertical: 0 }]}>
            {data.shops.length === 0 && <Text style={[s.muted, { paddingVertical: 16 }]}>No shops have registered yet.</Text>}
            {data.shops.map((u, i) => (
              <Row key={u.id} first={i === 0}>
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <Text style={[s.body, { fontFamily: F.semi, flex: 1 }]}>{u.shop_name}</Text>
                  <Badge label={u.status === 'pending' ? 'Pending' : u.status === 'approved' ? 'Approved' : 'Rejected'} tone={u.status === 'pending' ? 'gold' : u.status === 'approved' ? 'green' : 'red'} />
                </View>
                <Text style={s.small} selectable>
                  {u.name} · {u.phone}
                  {u.city ? ` · ${u.city}` : ''}
                </Text>
                <View style={[s.row, { marginTop: 10 }]}>
                  {u.status !== 'approved' && (
                    <Button
                      title="Approve"
                      icon="checkmark"
                      disabled={!!busy}
                      busy={busy === `s-${u.id}`}
                      onPress={() => act(`s-${u.id}`, () => adminShop(u.id, true))}
                      style={{ flex: 1, marginRight: 10, height: 44 }}
                    />
                  )}
                  {u.status !== 'rejected' && (
                    <Button
                      title={u.status === 'approved' ? 'Remove shop price' : 'Reject'}
                      variant="secondary"
                      disabled={!!busy}
                      busy={busy === `r-${u.id}`}
                      onPress={() => act(`r-${u.id}`, () => adminShop(u.id, false))}
                      style={{ flex: 1, height: 44 }}
                    />
                  )}
                </View>
              </Row>
            ))}
          </View>
        ) : tab === 'promos' ? (
          <>
            <Text style={[s.section, { marginBottom: 10 }]}>New promo code</Text>
            <View style={[s.panel, { paddingBottom: 4 }]}>
              <Field label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} hint="FAMILY100" caps />
              <Field label="Discount %" value={pct} onChange={setPct} keyboard="number-pad" note="100 makes the video free." />
              <Field label="How many times it can be used" value={maxUses} onChange={setMaxUses} keyboard="number-pad" hint="Leave empty for no limit" />
              <Field label="Last day (optional)" value={expires} onChange={setExpires} hint="2027-03-31" autoCap="none" />
              <Field label="Note for yourself" value={note} onChange={setNote} hint="For cousins" autoCap="sentences" />
              <Button
                title="Save promo code"
                disabled={code.length < 3 || !!busy}
                busy={busy === 'promo'}
                onPress={() =>
                  act('promo', async () => {
                    await adminSavePromo({
                      code,
                      discount_pct: Number(pct) || 100,
                      max_uses: maxUses ? Number(maxUses) : null,
                      expires_at: expires ? `${expires}T23:59:59` : undefined,
                      note,
                    });
                    setCode('');
                    setMaxUses('');
                    setExpires('');
                    setNote('');
                  })
                }
                style={{ marginBottom: 12 }}
              />
            </View>
            <Text style={[s.section, { marginTop: 22, marginBottom: 10 }]}>Promo codes</Text>
            <View style={[s.panel, { paddingVertical: 0 }]}>
              {data.promos.length === 0 && <Text style={[s.muted, { paddingVertical: 16 }]}>No promo codes yet.</Text>}
              {data.promos.map((p, i) => (
                <Row key={p.code} first={i === 0}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={[s.body, { fontFamily: F.bold, letterSpacing: 1 }]} selectable>
                      {p.code}
                    </Text>
                    <Badge label={p.active ? `${p.discount_pct}% off` : 'Turned off'} tone={p.active ? 'green' : 'grey'} />
                  </View>
                  <Text style={s.small}>
                    Used {p.used}
                    {p.max_uses != null ? ` of ${p.max_uses}` : ''} times
                    {p.expires_at ? ` · until ${new Date(p.expires_at).toLocaleDateString()}` : ''}
                    {p.note ? ` · ${p.note}` : ''}
                  </Text>
                  <Pressable
                    onPress={() => act(`p-${p.code}`, () => adminPromoActive(p.code, !p.active))}
                    disabled={!!busy}
                    hitSlop={6}
                  >
                    <Text style={{ fontFamily: F.semi, fontSize: 13, color: C.maroon, marginTop: 6 }}>{p.active ? 'Turn off' : 'Turn on'}</Text>
                  </Pressable>
                </Row>
              ))}
            </View>
          </>
        ) : (
          <View style={[s.panel, { paddingVertical: 0 }]}>
            {data.orders.length === 0 && <Text style={[s.muted, { paddingVertical: 16 }]}>No videos yet.</Text>}
            {data.orders.map((o, i) => (
              <Row key={o.id} first={i === 0}>
                <View style={[s.row, { justifyContent: 'space-between' }]}>
                  <Text style={[s.body, { fontFamily: F.semi }]}>
                    {o.category} · {o.template}
                  </Text>
                  <Badge label={o.pay_status === 'paid' ? `Paid ₹${o.price}` : o.pay_status} tone={payTone(o)} />
                </View>
                <Text style={s.small}>
                  {when(o.created_at)} · {o.status}
                  {o.promo_code ? ` · promo ${o.promo_code}` : ''}
                  {o.error ? ` · ${o.error}` : ''}
                </Text>
              </Row>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
