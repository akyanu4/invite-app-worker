import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { notify } from './platform/notify';
import { C, F, s } from './theme';
import type { MusicChoice, MusicTrack } from './types';

const MAX_SONG_MB = 15;

function Radio(props: { on: boolean }) {
  return <Ionicons name={props.on ? 'radio-button-on' : 'radio-button-off'} size={20} color={props.on ? C.maroon : C.faint} />;
}

/** "Music" section: the design's own music, a track from the library (with a listen button), or the customer's song. */
export function MusicPicker(props: {
  tracks: MusicTrack[];
  designMusic?: string;
  value: MusicChoice;
  onChange: (m: MusicChoice) => void;
}) {
  const { tracks, value } = props;
  // one player for listening to samples; an audio file plays fine through the video player
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setPlaying(null));
    return () => {
      sub.remove();
      player.pause();
    };
  }, [player]);

  function listen(t: MusicTrack) {
    if (playing === t.id) {
      player.pause();
      setPlaying(null);
      return;
    }
    player.replace(t.url);
    player.muted = false;
    player.play();
    setPlaying(t.id);
  }

  async function pickSong() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    if (a.size && a.size > MAX_SONG_MB * 1024 * 1024) {
      notify('Song file is too big', `Choose a file under ${MAX_SONG_MB} MB (an MP3 of a normal song is usually 3–8 MB).`);
      return;
    }
    player.pause();
    setPlaying(null);
    props.onChange({ kind: 'upload', uri: a.uri, name: a.name, mimeType: a.mimeType });
  }

  const row = (on: boolean) => [
    s.row,
    { paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: on ? C.maroonSoft : 'transparent' },
  ];

  return (
    <View>
      <Text style={[s.section, { marginBottom: 4 }]}>Music</Text>
      <Text style={[s.small, { marginBottom: 12 }]}>Choose what plays under your video.</Text>
      <View style={[s.panel, { padding: 0, overflow: 'hidden' }]}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: value.kind === 'design' }}
          onPress={() => props.onChange({ kind: 'design' })}
          style={[...row(value.kind === 'design'), { borderTopWidth: 0 }]}
        >
          <Radio on={value.kind === 'design'} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>Design’s own music</Text>
            <Text style={s.small}>{props.designMusic ? `${props.designMusic}, chosen for this design` : 'Chosen to match this design'}</Text>
          </View>
        </Pressable>

        {tracks.map((t) => {
          const on = value.kind === 'library' && value.id === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => props.onChange({ kind: 'library', id: t.id })}
              style={row(on)}
            >
              <Radio on={on} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>{t.title}</Text>
                {!!t.mood && <Text style={s.small}>{t.mood}</Text>}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing === t.id ? `Stop ${t.title}` : `Listen to ${t.title}`}
                onPress={() => listen(t)}
                hitSlop={8}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft }}
              >
                <Ionicons name={playing === t.id ? 'stop' : 'play'} size={18} color={C.maroon} style={{ marginLeft: playing === t.id ? 0 : 2 }} />
              </Pressable>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: value.kind === 'upload' }}
          onPress={pickSong}
          style={row(value.kind === 'upload')}
        >
          <Radio on={value.kind === 'upload'} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 15, color: C.ink }}>Your own song</Text>
            <Text style={s.small} numberOfLines={1}>
              {value.kind === 'upload' ? value.name : `MP3 or M4A from your phone, up to ${MAX_SONG_MB} MB`}
            </Text>
          </View>
          <Text style={{ fontFamily: F.semi, fontSize: 14, color: C.maroon }}>{value.kind === 'upload' ? 'Change' : 'Choose file'}</Text>
        </Pressable>
      </View>
      {value.kind === 'upload' && (
        <Text style={[s.small, { marginTop: 6 }]}>
          The song starts from the beginning and repeats if the video is longer. Only use music you’re allowed to share.
        </Text>
      )}
    </View>
  );
}
