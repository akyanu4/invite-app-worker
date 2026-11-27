import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyPromo, getOrder, qrImageUrl, submitUtr, upiLink } from '../api';
import { Badge, Button, Header, StepBar } from '../components';
import { notify } from '../platform/notify';
import { queueText } from './ProgressScreen';
import { SAVE_LABEL, saveVideo, shareVideo } from '../platform/video';
import { C, F, s } from '../theme';
import type { AppConfig, HistoryItem, Order } from '../types';

/**
 * Plays the video. An unpaid preview gets our own play and sound buttons instead of the browser's
 * controls (which offer "Download"), and a cover that blocks long-press / right-click "Save video".
 */
function Player(props: { uri: string; locked: boolean }) {
  const player = useVideoPlayer(props.uri, (p) => {
    p.loop = true;
    // Browsers only autoplay muted video; tap the speaker icon to hear the music.
    if (Platform.OS === 'web') p.muted = true;
    p.play();
  });
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(Platform.OS === 'web');
  useEffect(() => {
    const a = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !player.playing) player.play();
    });
    const b = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying));
    return () => {
      a.remove();
      b.remove();
    };
  }, [player]);

  if (!props.locked) {
    return <VideoView player={player} nativeControls playsInline contentFit="contain" style={{ width: '100%', height: '100%' }} />;
  }
  const round = { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ width: '100%', height: '100%' }}>
      <VideoView player={player} nativeControls={false} playsInline contentFit="contain" allowsPictureInPicture={false} style={{ width: '100%', height: '100%' }} />
      {/* cover: taps toggle play; the video element itself is never pressed, so no "Save video" menu */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}
        onPress={() => (playing ? player.pause() : player.play())}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        // @ts-expect-error web-only: block the browser's right-click menu on the preview
        onContextMenu={(e: { preventDefault: () => void }) => e.preventDefault()}
      >
        {!playing && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={[round, { width: 64, height: 64, borderRadius: 32 }]}>
              <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
        onPress={() => {
          player.muted = !muted;
          setMuted(!muted);
        }}
        hitSlop={8}
        style={[round, { position: 'absolute', right: 10, bottom: 10 }]}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const busyStates = new Set(['queued', 'rendering']);

export function ResultScreen(props: {
  item: HistoryItem;
  config: AppConfig | null;
  onHome: () => void;
  onEdit: () => void;
}) {
  const { item, config } = props;
  const [order, setOrder] = useState<Order | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<'' | 'share' | 'save' | 'utr' | 'promo'>('');
  const [utr, setUtr] = useState('');
  const [promo, setPromo] = useState('');
  const [showPromo, setShowPromo] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setOrder(await getOrder(item.id));
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [item.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // keep checking while the video is being made or the payment is being checked
  const waiting = !!order && (busyStates.has(order.status) || order.pay_status === 'submitted');
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  const paid = order?.pay_status === 'paid' && !!order.final_url;
  const file = paid ? { id: item.id, title: item.title, videoUrl: order!.final_url! } : null;

  async function share() {
    if (!file) return;
    try {
      setBusy('share');
      const msg = await shareVideo(file);
      if (msg) notify('Video downloaded', msg);
    } catch (e) {
      notify('Couldn’t open sharing', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!file) return;
    try {
      setBusy('save');
      notify('Saved', await saveVideo(file));
    } catch (e) {
      notify('Couldn’t save the video', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function sendUtr() {
    try {
      setBusy('utr');
      setOrder(await submitUtr(item.id, utr.trim()));
      setUtr('');
    } catch (e) {
      notify('Couldn’t send the transaction ID', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  async function usePromo() {
    try {
      setBusy('promo');
      const o = await applyPromo(item.id, promo.trim());
      setOrder(o);
      setPromo('');
      setShowPromo(false);
      if (o.pay_status === 'paid') notify('Promo code applied', 'Your video is unlocked.');
    } catch (e) {
      notify('Promo code not applied', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  // ---------------------------------------------------------------- states before the video
  if (!order) {
    return (
      <SafeAreaView style={s.screen}>
        <Header title="Your video" onBack={props.onHome} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {loadError ? (
            <>
              <Text style={[s.muted, { textAlign: 'center' }]}>{loadError}</Text>
              <Button title="Try again" icon="refresh" variant="secondary" onPress={refresh} style={{ marginTop: 16 }} />
            </>
          ) : (
            <ActivityIndicator color={C.maroon} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (order.status !== 'ready') {
    const failed = order.status === 'failed';
    return (
      <SafeAreaView style={s.screen}>
        <Header title="Your video" onBack={props.onHome} />
        <View style={[s.column, { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
          {failed ? (
            <Ionicons name="alert-circle-outline" size={44} color={C.danger} />
          ) : (
            <ActivityIndicator size="large" color={C.maroon} />
          )}
          <Text style={[s.title, { marginTop: 14, textAlign: 'center' }]}>
            {failed ? 'The video wasn’t created' : order.status === 'rendering' ? 'Making your preview' : 'Your video is in the queue'}
          </Text>
          <Text style={[s.muted, { textAlign: 'center', marginTop: 8 }]}>
            {failed
              ? order.error || 'Something went wrong.'
              : `${queueText(order, Date.now() - new Date(order.created_at).getTime() > 45 * 60_000)} You can close the app and come back; this page updates by itself.`}
          </Text>
          <Button title="Edit details" icon="create-outline" variant="secondary" onPress={props.onEdit} style={{ marginTop: 22, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------- ready
  const priceText = `₹${order.price}`;
  const submitted = order.pay_status === 'submitted';
  const rejected = order.pay_status === 'rejected';

  return (
    <SafeAreaView style={s.screen}>
      <Header title="Your video" onBack={props.onHome} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.column, s.scroll]} keyboardShouldPersistTaps="handled">
          <StepBar step={3} done={paid} />
          <View style={{ width: '72%', maxWidth: 300, alignSelf: 'center', aspectRatio: 9 / 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
            {(paid ? order.final_url : order.preview_url) ? (
              <Player key={paid ? 'final' : 'preview'} uri={(paid ? order.final_url : order.preview_url)!} locked={!paid} />
            ) : null}
          </View>
          <Text style={[s.title, { textAlign: 'center', marginTop: 16 }]}>{item.title}</Text>
          <View style={{ alignSelf: 'center', marginTop: 6 }}>
            {paid ? <Badge label="Unlocked" tone="green" /> : <Badge label="Free preview" tone="gold" />}
          </View>
          {Platform.OS === 'web' && <Text style={[s.small, { textAlign: 'center', marginTop: 6 }]}>Tap the speaker on the video to hear the music.</Text>}

          {item.fromCard && (
            <View style={[s.panel, { marginTop: 16, backgroundColor: C.goldSoft, borderColor: C.goldSoft }]}>
              <Text style={[s.small, { color: C.ink }]}>
                Our AI read these details from your card. Check the names and dates in the preview, and use Edit
                details if anything needs correcting{paid ? '' : ' before you pay'}.
              </Text>
            </View>
          )}

          {!paid && (
            <View style={[s.panel, { marginTop: 18 }]}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.section}>Unlock the full video</Text>
                <Text style={{ fontFamily: F.display, fontSize: 24, color: C.maroon }}>{priceText}</Text>
              </View>
              <Text style={[s.small, { marginTop: 4 }]}>
                No watermark, full quality, ready to share on WhatsApp and download.
                {order.promo_code ? ` Promo ${order.promo_code} applied.` : ''}
              </Text>

              {submitted ? (
                <View style={[s.row, { marginTop: 16, alignItems: 'flex-start' }]}>
                  <ActivityIndicator color={C.gold} style={{ marginRight: 10, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.body, { fontFamily: F.semi }]}>Checking your payment</Text>
                    <Text style={s.small}>
                      Transaction ID {order.utr}. The video unlocks here as soon as the payment is confirmed, usually
                      within a few hours. You can close the app; it stays under “Your videos”.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {rejected && (
                    <View style={{ marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: '#F8E4E2' }}>
                      <Text style={[s.small, { color: C.danger }]}>{order.pay_note || 'The payment could not be confirmed.'}</Text>
                    </View>
                  )}
                  <Text style={[s.label, { marginTop: 16 }]}>1. Pay {priceText} by UPI</Text>
                  {config?.upi.vpa ? (
                    <>
                      {Platform.OS !== 'web' || !/Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent ?? '') ? (
                        <View style={{ alignItems: 'center', marginVertical: 8 }}>
                          <Image source={{ uri: qrImageUrl(order.id) }} style={{ width: 180, height: 180, borderRadius: 8 }} />
                          <Text style={[s.small, { marginTop: 6 }]}>Scan with any UPI app</Text>
                        </View>
                      ) : null}
                      <Button
                        title="Pay with a UPI app"
                        icon="wallet-outline"
                        variant="secondary"
                        onPress={() =>
                          Linking.openURL(upiLink(config, order)).catch(() =>
                            notify('No UPI app found', `Pay ${priceText} to ${config.upi.vpa} from any UPI app.`)
                          )
                        }
                      />
                      <Text style={[s.small, { marginTop: 6, textAlign: 'center' }]} selectable>
                        UPI ID: {config.upi.vpa}
                      </Text>
                    </>
                  ) : (
                    <Text style={s.small}>Payments are not set up yet.</Text>
                  )}

                  <Text style={[s.label, { marginTop: 18 }]}>2. Enter the transaction ID</Text>
                  <TextInput
                    style={s.input}
                    value={utr}
                    onChangeText={(v) => setUtr(v.replace(/\s/g, ''))}
                    placeholder="12-digit UTR / UPI reference no."
                    placeholderTextColor={C.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                    maxLength={22}
                  />
                  <Text style={[s.small, { marginTop: 4 }]}>Find it in your UPI app’s payment details after paying.</Text>
                  <Button
                    title="Send for confirmation"
                    icon="checkmark-circle-outline"
                    onPress={sendUtr}
                    busy={busy === 'utr'}
                    disabled={utr.length < 8 || !!busy}
                    style={{ marginTop: 12 }}
                  />
                </>
              )}

              <View style={{ height: 1, backgroundColor: C.line, marginVertical: 16 }} />
              {showPromo ? (
                <View style={s.row}>
                  <TextInput
                    style={[s.input, { flex: 1, marginRight: 10 }]}
                    value={promo}
                    onChangeText={(v) => setPromo(v.toUpperCase())}
                    placeholder="Promo code"
                    placeholderTextColor={C.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onSubmitEditing={usePromo}
                  />
                  <Button title="Apply" variant="secondary" onPress={usePromo} busy={busy === 'promo'} disabled={!promo.trim() || !!busy} />
                </View>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setShowPromo(true)} hitSlop={8} style={s.row}>
                  <Ionicons name="pricetag-outline" size={16} color={C.maroon} />
                  <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.maroon, marginLeft: 6 }}>Have a promo code?</Text>
                </Pressable>
              )}
            </View>
          )}

          {!paid && (
            <Button title="Edit details" icon="create-outline" variant="quiet" onPress={props.onEdit} style={{ marginTop: 8 }} />
          )}
        </ScrollView>
        {paid && (
          <SafeAreaView edges={['bottom']} style={s.footer}>
            <View style={s.column}>
              <Button title="Share on WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={share} busy={busy === 'share'} disabled={!!busy} />
              <View style={[s.row, { marginTop: 10 }]}>
                <Button
                  title={SAVE_LABEL}
                  icon="download-outline"
                  variant="secondary"
                  onPress={save}
                  busy={busy === 'save'}
                  disabled={!!busy}
                  style={{ flex: 1, marginRight: 10 }}
                />
                <Button title="Edit details" icon="create-outline" variant="secondary" onPress={props.onEdit} style={{ flex: 1 }} />
              </View>
            </View>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
