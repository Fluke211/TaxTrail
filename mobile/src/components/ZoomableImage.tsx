// Receipt photo that opens full-screen and pinch-zooms.
//
// Receipts are dense, faded, and small on a phone — reviewing a parse means
// actually reading the line items, which a 170px-tall thumbnail cannot support.
//
// The zoom is plain ScrollView: on iOS it does pinch-to-zoom natively via
// maximumZoomScale, so this needs no gesture-handler/reanimated and therefore
// no native build (see D-009 on keeping the native surface minimal). Android
// ScrollView ignores those props; when Android is taken seriously it needs a
// different mechanism.
import React, { useState } from 'react';
import {
  Image, Modal, Pressable, ScrollView, Text, View,
  useWindowDimensions, type ImageStyle, type StyleProp,
} from 'react-native';
import { styled, useTheme } from '../lib/theme';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
  /** Hidden when the caller already labels the image. */
  hint?: boolean;
}

export function ZoomableImage({ uri, style, hint = true }: Props) {
  const T = useTheme();
  const s = makeStyles(T);
  const [open, setOpen] = useState(false);
  const { width, height } = useWindowDimensions();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Receipt photo, tap to zoom"
      >
        <Image source={{ uri }} style={style} resizeMode="contain" />
        {hint && (
          <View style={s.hint} pointerEvents="none">
            <Text style={s.hintText}>Tap to zoom</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={s.backdrop}>
          <ScrollView
            style={s.fill}
            contentContainerStyle={{ width, height }}
            maximumZoomScale={8}
            minimumZoomScale={1}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
          </ScrollView>
          <Pressable style={s.close} onPress={() => setOpen(false)} hitSlop={16}>
            <Text style={s.closeText}>Done</Text>
          </Pressable>
          <Text style={s.tip}>Pinch to zoom · drag to pan</Text>
        </View>
      </Modal>
    </>
  );
}

/* Text on the photo backdrop, which is black whatever the palette says. */
const ON_BLACK = '#b3bcca';

const makeStyles = styled((T) => ({
  hint: {
    position: 'absolute', right: 8, bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  hintText: { color: '#fff', fontSize: T.fs.xs, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1 },
  close: {
    position: 'absolute', top: 54, right: 18,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  closeText: { color: '#fff', fontSize: T.fs.body, fontWeight: '600' },
  /*
   * A fixed grey, not `T.muted2`.
   *
   * The backdrop is `#000` in both palettes, so this text does not sit on a
   * palette ground and must not take a palette colour. It did, and darkening
   * the light greys for AA (D-080) dropped it from 5.96:1 to 4.07:1 on black:
   * a change made for legibility took legibility away from the one place it
   * could not be measured, because every contrast pairing in the check is
   * token-against-token.
   *
   * `#b3bcca` on black is 9.6:1. `check-contrast.js` carries the pairing now.
   */
  tip: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    color: ON_BLACK, fontSize: T.fs.sm,
  },
}));
