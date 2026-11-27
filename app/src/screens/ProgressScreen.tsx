import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Header, StepBar } from '../components';
import { checkResult, newJobId, submitJob, uploadCardPhoto } from '../cloudinary';
import { PreviewVideo } from '../PreviewVideo';
import { C, F, s } from '../theme';
import type { Fields, InviteEvent, Job, JobResult, Settings, TemplateInfo } from '../types';
import type { PickedCard } from './CardScreen';

export type Request =
  | { kind: 'details'; template: string; fields: Fields; events: InviteEvent[] }
  | { kind: 'card'; template: string; card: PickedCard };

const POLL_MS = 5000;
const SLOW_AFTER_S = 90; // the PC usually picks a job up within ~10 s
const GIVE_UP_S = 15 * 60;

type Phase = 'uploading' | 'waiting' | 'slow' | 'error';

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
  settings: Settings;
  design: TemplateInfo;
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
    setElapsed(0);
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
            setError('No video after 15 minutes. Check that the rendering PC is on and connected to the internet, then try again.');
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

  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const isCard = props.request.kind === 'card';
  const d = props.design;

  return (
    <SafeAreaView style={s.screen}>
      <Header title="Creating video" />
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
            <Text style={[s.title, { textAlign: 'center', marginTop: 18 }]}>Creating your video</Text>
            <Text style={[s.small, { textAlign: 'center', marginTop: 4, marginBottom: 22 }]}>
              {time} so far. {isCard ? 'This usually takes 2–3 minutes.' : 'This usually takes 1–2 minutes.'}
            </Text>

            <View style={s.panel}>
              <Stage state={phase === 'uploading' ? 'active' : 'done'} title={isCard ? 'Sending the card photo' : 'Sending your details'} />
              <Stage
                state={phase === 'uploading' ? 'todo' : 'active'}
                title={isCard ? 'Reading the card and animating' : 'Animating your invitation'}
                note={
                  phase === 'slow'
                    ? 'Taking longer than usual. The rendering PC may be busy, asleep or offline. Nothing is lost if you wait.'
                    : 'You can leave this screen open; the video appears here when it is ready.'
                }
              />
              <Stage state="todo" title="Ready to share" />
            </View>
            <Button title="Cancel" variant="quiet" onPress={props.onCancel} style={{ marginTop: 12 }} />
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
