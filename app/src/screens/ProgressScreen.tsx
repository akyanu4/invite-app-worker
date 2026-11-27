import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TopBar } from '../components';
import { checkResult, newJobId, submitJob, uploadCardPhoto } from '../cloudinary';
import { C, s } from '../theme';
import type { Fields, InviteEvent, Job, JobResult, Settings } from '../types';
import type { PickedCard } from './CardScreen';

export type Request =
  | { kind: 'details'; template: string; fields: Fields; events: InviteEvent[] }
  | { kind: 'card'; template: string; card: PickedCard };

const POLL_MS = 5000;
const SLOW_AFTER_S = 90; // PC usually picks a job up within ~10 s
const GIVE_UP_S = 15 * 60;

type Phase = 'uploading' | 'waiting' | 'slow' | 'error';

export function ProgressScreen(props: {
  settings: Settings;
  request: Request;
  onDone: (job: Job, result: JobResult) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('uploading');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const started = Date.now();
    const tick = setInterval(() => alive.current && setElapsed(Math.round((Date.now() - started) / 1000)), 1000);

    (async () => {
      try {
        setPhase('uploading');
        setError('');
        const { settings, request } = props;
        const id = newJobId();
        const job: Job = { id, template: request.template || settings.template, fields: {} };
        if (request.kind === 'card') {
          job.card_image_url = await uploadCardPhoto(settings, id, request.card.uri, request.card.mimeType);
        } else {
          job.fields = request.fields;
          job.events = request.events;
        }
        await submitJob(settings, job);
        if (!alive.current) return;
        setPhase('waiting');

        while (alive.current) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          if (!alive.current) return;
          const secs = (Date.now() - started) / 1000;
          const result = await checkResult(settings, id);
          if (!alive.current) return;
          if (result) {
            if (result.status === 'failed') {
              setError(result.error || 'The video could not be made.');
              setPhase('error');
            } else {
              props.onDone(job, result);
            }
            return;
          }
          if (secs > GIVE_UP_S) {
            setError('No video after 15 minutes. Is the PC on and connected to the internet?');
            setPhase('error');
            return;
          }
          if (secs > SLOW_AFTER_S) setPhase('slow');
        }
      } catch (e) {
        if (!alive.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();

    return () => {
      alive.current = false;
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, '0');
  const isCard = props.request.kind === 'card';

  return (
    <SafeAreaView style={s.screen}>
      <TopBar title="Making your video" />
      <ScrollView contentContainerStyle={[s.scroll, { alignItems: 'center', paddingTop: 50 }]}>
        {phase !== 'error' ? (
          <>
            <ActivityIndicator size="large" color={C.gold} />
            <Text style={[s.h1, { marginTop: 24, textAlign: 'center' }]}>
              {phase === 'uploading' ? 'Sending…' : 'Rendering…'}
            </Text>
            <Text style={[s.p, { textAlign: 'center' }]}>
              {phase === 'uploading'
                ? isCard
                  ? 'Uploading the card photo.'
                  : 'Sending the details.'
                : isCard
                  ? 'Reading the card and animating it. This usually takes 2–3 minutes.'
                  : 'Animating your invitation. This usually takes 1–2 minutes.'}
            </Text>
            <Text style={{ marginTop: 18, fontSize: 28, color: C.goldDark, fontVariant: ['tabular-nums'] }}>
              {mins}:{secs}
            </Text>
            {phase === 'slow' && (
              <View style={[s.card, { marginTop: 24, backgroundColor: C.goldLight }]}>
                <Text style={{ color: C.text }}>
                  This is taking longer than usual. The rendering PC may be busy, asleep or offline. You can keep
                  waiting, as nothing is lost.
                </Text>
              </View>
            )}
            <View style={{ alignSelf: 'stretch', marginTop: 30 }}>
              <Button title="Cancel" ghost onPress={props.onCancel} />
            </View>
          </>
        ) : (
          <>
            <Text style={[s.h1, { color: C.danger }]}>Something went wrong</Text>
            <Text style={[s.p, { textAlign: 'center', marginTop: 8 }]}>{error}</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 24 }}>
              <Button title="Try again" onPress={() => setAttempt((a) => a + 1)} />
              <Button title="Back" ghost onPress={props.onCancel} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
