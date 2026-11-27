import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

/** A small muted looping clip, used for the design previews. */
export function PreviewVideo(props: { uri: string; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(props.uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // An early play() is ignored in browsers, so start again once the clip has loaded.
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !player.playing) player.play();
    });
    return () => sub.remove();
  }, [player]);
  return <VideoView player={player} style={props.style} contentFit="cover" nativeControls={false} playsInline />;
}
