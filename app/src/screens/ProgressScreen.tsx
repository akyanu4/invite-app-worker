import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createOrder, getOrder, uploadCard } from '../api';
import { Button, Header, StepBar } from '../components';
import { PreviewVideo } from '../PreviewVideo';
import { deviceId } from '../storage';
import { C, F, s } from '../theme';
import type { AiQuality, Fields, InviteEvent, Order, TemplateInfo } from '../types';
import type { PickedCard } from './CardScreen';

export type Request =
  | { kind: 'details'; category: string; template: string; fields: Fields; events: InviteEvent[] }
  | { kind: 'card'; category: string; template: string; card: PickedCard; quality: AiQuality };

const POLL_MS = 15000;
const SLOW_AFTER_S = 45 * 60;

type Phase = 'sending' | 'queued' | 'rendering' | 'error';

/** Shared wording for a video that is waiting, also used on the video screen. */
export function queueText(order: Pick<Order, 'status' | 'queue_position'> | null, slow = false) {
  if (slow) return 'Taking longer than usual: the computer that makes the videos may be switched off. Nothing is lost; it will be made when it is back on.';
  if (order?.status === 'rendering') return 'Your invitation is being animated now. This takes about 2–3 minutes.';
  const pos = order?.queue_position ?? 1;
  const ahead = pos > 1 ? `${pos - 1} ${pos - 1 === 1 ? 'video is' : 'videos are'} ahead of yours. ` : 'Yours is next. ';
  return `${ahead}Videos are usually ready within 20 minutes.`;
}

function Stage(props: { state: 'done' | 'active' | 'todo'; title: string; note?: string }) {
  return (
    <View style={[s.row, { alignItems: 'flex-start', marginBottom: 14 }]}>
      <View style={{ width: 24, alignItems: 'center', marginRight: 12, paddingTop: 1 }}>
        {props.state === 'done' ? (
          <Ionicons name="checkmark-circle" size={22} color={C.success} />
        ) : props.state === 'active' ? (
          <ActivityIndicator size="small" color={C.maroon} />
        ) : (
          <Ionicons name="ellipse-outline" size={20} color={C.line} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: props.state === 'todo' ? F.body : F.semi, fontSize: 15, color: props.state === 'todo' ? C.faint : C.ink }}>
          {props.title}
        </Text>
        {!!props.note && props.state === 'active' && <Text style={[s.small, { marginTop: 2 }]}>{props.note}</Text>}
      </View>
    </View>
  );
}

export function ProgressScreen(props: {
  design: TemplateInfo;
  request: Request;
  onCreated: (order: Order) => void;
  onDone: (order: Order) => void;
  onCancel: () => void;
  onHome: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('sending');
  const [order, setOrder] = useState<Order | null>(null);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const started = Date.now();

    (async () => {
      try {
        setPhase('sending');
        setError('');
        const { request } = props;
        const base = { device_id: await deviceId(), category: request.category, template: request.template };
        const created =
          request.kind === 'card'
            ? await createOrder({
                ...base,
                card_image_url: await uploadCard(request.card.uri, request.card.mimeType),
                ai_quality: request.quality,
              })
            : await createOrder({ ...base, fields: request.fields, events: request.events });
        if (!alive.current) return;
        props.onCreated(created);
        setPhase('queued');

        while (alive.current) {
          const o = await getOrder(created.id).catch(() => null);
          if (!alive.current) return;
          if (o) {
            setOrder(o);
            if (o.status === 'failed') {
              setError(o.error || 'The video could not be made.');
              setPhase('error');
              return;
            }
            if (o.status === 'ready') {
              props.onDone(o);
              return;
            }
            setPhase(o.status === 'rendering' ? 'rendering' : 'queued');
          }
          setSlow((Date.now() - started) / 1000 > SLOW_AFTER_S);
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();

    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const isCard = props.request.kind === 'card';
  const d = props.design;
  const sent = phase !== 'sending';

  return (
    <SafeAreaView style={s.screen}>
      <Header title="Creating preview" />
      <ScrollView contentContainerStyle={[s.column, s.scroll]}>
        <StepBar step={3} />
        {phase !== 'error' ? (
          <>
            <View style={{ width: 150, alignSelf: 'center', aspectRatio: 9 / 16, borderRadius: 12, overflow: 'hidden', backgroundColor: C.line }}>
              {d.preview_video_url ? (
                <PreviewVideo uri={d.preview_video_url} poster={d.preview_url} style={{ width: '100%', height: '100%' }} />
              ) : d.preview_url ? (
                <Image source={{ uri: d.preview_url }} style={{ width: '100%', height: '100%' }} />
              ) : null}
            </View>
            <Text style={[s.title, { textAlign: 'center', marginTop: 18 }]}>
              {phase === 'sending' ? 'Sending your order' : phase === 'rendering' ? 'Making your preview' : 'Your video is in the queue'}
            </Text>
            {sent && (
              <Text style={[s.muted, { textAlign: 'center', marginTop: 6 }]}>{queueText(order ?? { status: 'queued' }, slow)}</Text>
            )}

            {sent && (
              <View style={[s.row, { backgroundColor: C.goldSoft, borderRadius: 12, padding: 12, marginTop: 18, alignItems: 'flex-start' }]}>
                <Ionicons name="time-outline" size={20} color={C.gold} style={{ marginRight: 10, marginTop: 1 }} />
                <Text style={[s.small, { flex: 1, color: C.ink }]}>
                  You don’t need to wait here. Close the app and come back later: your video will be under{' '}
                  <Text style={{ fontFamily: F.semi }}>Your videos</Text> on the home screen, ready to watch and download.
                </Text>
              </View>
            )}

            <View style={[s.panel, { marginTop: 18 }]}>
              <Stage state={sent ? 'done' : 'active'} title={isCard ? 'Card photo sent' : 'Details sent'} />
              <Stage
                state={phase === 'queued' ? 'active' : phase === 'rendering' ? 'done' : 'todo'}
                title="Waiting in the queue"
              />
              <Stage state={phase === 'rendering' ? 'active' : 'todo'} title={isCard ? 'Reading the card and animating' : 'Animating your invitation'} />
              <Stage state="todo" title="Free preview ready" />
            </View>
            {sent ? (
              <Button title="Back to home" icon="home-outline" variant="secondary" onPress={props.onHome} style={{ marginTop: 14 }} />
            ) : (
              <Button title="Cancel" variant="quiet" onPress={props.onCancel} style={{ marginTop: 12 }} />
            )}
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 30 }}>
            <Ionicons name="alert-circle-outline" size={44} color={C.danger} />
            <Text style={[s.title, { marginTop: 12, textAlign: 'center' }]}>The video wasn’t created</Text>
            <Text style={[s.muted, { textAlign: 'center', marginTop: 8 }]}>{error}</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
              <Button title="Try again" icon="refresh" onPress={() => setAttempt((a) => a + 1)} />
              <Button title="Back to details" variant="quiet" onPress={props.onCancel} style={{ marginTop: 6 }} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
