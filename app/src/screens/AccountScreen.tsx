import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminSignIn, signIn, signUp } from '../api';
import { Badge, Button, Chip, Field, Header } from '../components';
import { notify } from '../platform/notify';
import { setAdminToken, setShopToken } from '../storage';
import { C, F, s } from '../theme';
import type { AppConfig, ShopUser } from '../types';

export function AccountScreen(props: {
  shop: ShopUser | null;
  hasAdmin: boolean;
  config: AppConfig | null;
  onBack: () => void;
  onShop: (u: ShopUser | null) => void;
  onAdmin: () => void;
}) {
  const { shop, config } = props;
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [busy, setBusy] = useState('');
  const shopPrice = config ? `₹${config.prices.shop}` : 'a lower price';
  const customerPrice = config ? `₹${config.prices.customer}` : 'the normal price';

  async function submit() {
    try {
      setBusy('shop');
      const r = mode === 'in' ? await signIn(phone, password) : await signUp({ phone, password, name, shop_name: shopName, city });
      await setShopToken(r.token);
      props.onShop(r.user);
      setPassword('');
    } catch (e) {
      notify(mode === 'in' ? 'Couldn’t sign in' : 'Couldn’t register', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function admin() {
    try {
      setBusy('admin');
      const r = await adminSignIn(adminPw);
      await setAdminToken(r.token);
      setAdminPw('');
      props.onAdmin();
    } catch (e) {
      notify('Couldn’t open admin', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <Header title="Account" onBack={props.onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.column, s.scroll]} keyboardShouldPersistTaps="handled">
          {shop ? (
            <View style={s.panel}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.section}>{shop.shop_name}</Text>
                  <Text style={s.small}>
                    {shop.name} · {shop.phone}
                    {shop.city ? ` · ${shop.city}` : ''}
                  </Text>
                </View>
                {shop.status === 'approved' ? (
                  <Badge label="Approved" tone="green" />
                ) : shop.status === 'pending' ? (
                  <Badge label="Waiting for approval" tone="gold" />
                ) : (
                  <Badge label="Not approved" tone="red" />
                )}
              </View>
              <Text style={[s.small, { marginTop: 12, color: C.ink }]}>
                {shop.status === 'approved'
                  ? `Each video costs ${shopPrice} while you are signed in.`
                  : shop.status === 'pending'
                    ? `We check new shops by phone. Until then videos cost ${customerPrice}; after approval they cost ${shopPrice}.`
                    : 'Your shop registration was not approved. Contact us if you think this is a mistake.'}
              </Text>
              <Button
                title="Sign out"
                icon="log-out-outline"
                variant="secondary"
                style={{ marginTop: 14 }}
                onPress={async () => {
                  await setShopToken(null);
                  props.onShop(null);
                }}
              />
            </View>
          ) : (
            <>
              <Text style={s.display}>For shops</Text>
              <Text style={[s.muted, { marginTop: 6, marginBottom: 18 }]}>
                Card printers and shops pay {shopPrice} per video instead of {customerPrice}. Register once; we approve your
                shop, usually within a day.
              </Text>
              <View style={[s.row, { marginBottom: 16 }]}>
                <Chip label="Sign in" on={mode === 'in'} onPress={() => setMode('in')} />
                <Chip label="Register a shop" on={mode === 'up'} onPress={() => setMode('up')} />
              </View>
              <View style={[s.panel, { paddingBottom: 4 }]}>
                {mode === 'up' && (
                  <>
                    <Field label="Your name" value={name} onChange={setName} hint="Ayaan Khan" />
                    <Field label="Shop name" value={shopName} onChange={setShopName} hint="Noor Card Printers" />
                    <Field label="City" value={city} onChange={setCity} hint="Hyderabad" />
                  </>
                )}
                <Field label="Mobile number" value={phone} onChange={setPhone} hint="98765 43210" keyboard="phone-pad" autoCap="none" />
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  secure
                  autoCap="none"
                  note={mode === 'up' ? 'At least 6 characters.' : undefined}
                />
              </View>
              <Button
                title={mode === 'in' ? 'Sign in' : 'Register shop'}
                onPress={submit}
                busy={busy === 'shop'}
                disabled={!phone || !password || (mode === 'up' && (!name || !shopName))}
                style={{ marginTop: 14 }}
              />
            </>
          )}

          <View style={{ marginTop: 36 }}>
            {props.hasAdmin ? (
              <Button title="Open admin" icon="shield-checkmark-outline" variant="secondary" onPress={props.onAdmin} />
            ) : showAdmin ? (
              <View style={[s.panel, { paddingBottom: 4 }]}>
                <Field label="Admin password" value={adminPw} onChange={setAdminPw} secure autoCap="none" />
                <Button title="Open admin" onPress={admin} busy={busy === 'admin'} disabled={!adminPw} style={{ marginBottom: 12 }} />
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setShowAdmin(true)} style={[s.row, { alignSelf: 'center' }]} hitSlop={8}>
                <Ionicons name="shield-outline" size={15} color={C.faint} />
                <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.faint, marginLeft: 5 }}>Admin</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
