import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** A small muted looping clip, used for the design previews. */
export function PreviewVideo(props: { uri: string; poster?: string; style?: StyleProp<ViewStyle> }) {
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
  // The still picture sits underneath, so the box is never empty while the clip loads.
  return (
    <View style={[{ overflow: 'hidden' }, props.style]}>
      {!!props.poster && <Image source={{ uri: props.poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} playsInline />
    </View>
  );
}
