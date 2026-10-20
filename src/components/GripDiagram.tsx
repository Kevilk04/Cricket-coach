import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { GripStage } from '@/data/skills';
import type { Hand } from '@/lib/pose/landmarks';
import { C } from '@/theme';

type Props = {
  hand: Hand;
  stage: GripStage;
  height?: number;
  style?: ViewStyle;
};

// The picture is drawn on a 300 by 380 board and scaled to fit.
const W = 300;
const H = 380;
const CX = 150;
const HANDLE = { top: 16, bottom: 172, half: 13 };
const BLADE = { top: 172, shoulder: 204, bottom: 352, half: 45 };
const TOP_HAND_Y = 40;
const BOTTOM_HAND_Y = 102;
const HAND = { w: 88, h: 56 };
// On the web an SVG has no default font, so name one. Phones use their own.
const FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

const RED = '#FF5A5F';
const GLOVE = '#FFFFFF';
const GLOVE_EDGE = 'rgba(16,35,27,0.35)';

/**
 * The grip, drawn from behind the bat: handle at the top, blade below, and the two hands.
 * Each step of the demonstration shows a little more. It mirrors for left-handers, because
 * the top hand and the outside edge of the bat swap sides.
 */
export function GripDiagram({ hand, stage, height = 380, style }: Props) {
  // For a right-hander seen from behind the bat, the outside edge is on the right.
  const out = hand === 'right' ? 1 : -1;
  const topName = hand === 'right' ? 'Left hand' : 'Right hand';
  const bottomName = hand === 'right' ? 'Right hand' : 'Left hand';

  const showTop = stage !== 'bat';
  const showBottom = stage !== 'bat';
  const topOpacity = stage === 'bottom' ? 0.75 : 1;
  const bottomOpacity = stage === 'top' ? 0.22 : 1;
  const showVs = stage === 'vs';
  const pressure = stage === 'pressure';

  // Labels sit on the side away from the outside edge so they never cover the guide line.
  const labelX = CX - out * 62;
  const anchor = out === 1 ? 'end' : 'start';

  const glove = (y: number, opacity: number, ringed: boolean, fill: string) => (
    <G opacity={opacity}>
      {ringed ? <Rect x={CX - HAND.w / 2 - 7} y={y - 7} width={HAND.w + 14} height={HAND.h + 14} rx={26} fill="rgba(255,90,95,0.16)" stroke={RED} strokeWidth={3} /> : null}
      <Rect x={CX - HAND.w / 2} y={y} width={HAND.w} height={HAND.h} rx={20} fill={fill} stroke={GLOVE_EDGE} strokeWidth={1.5} />
      {/* Fingers wrap round the handle from the inside edge. */}
      {[0.28, 0.5, 0.72].map((t) => (
        <Line key={t} x1={CX - out * (HAND.w / 2 - 4)} y1={y + HAND.h * t} x2={CX - out * 8} y2={y + HAND.h * t} stroke={GLOVE_EDGE} strokeWidth={1.5} strokeLinecap="round" />
      ))}
    </G>
  );

  // The V between thumb and first finger, pointing down the back of the bat.
  const vee = (y: number) => {
    const px = CX + out * 19;
    return <Path d={`M ${px - 16} ${y + 10} L ${px} ${y + HAND.h - 9} L ${px + 16} ${y + 10}`} stroke={RED} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
  };

  const label = (y: number, text: string, sub: string, strong = false) => (
    <G>
      <Line x1={labelX + out * 4} y1={y} x2={CX - out * (HAND.w / 2 + 2)} y2={y} stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />
      <SvgText x={labelX} y={y - 3} fill="#FFFFFF" fontSize={16} fontWeight={strong ? '700' : '600'} fontFamily={FONT} textAnchor={anchor}>
        {text}
      </SvgText>
      <SvgText x={labelX} y={y + 15} fill="#DDEBE3" fontSize={13} fontFamily={FONT} textAnchor={anchor}>
        {sub}
      </SvgText>
    </G>
  );

  const plain = (x: number, y: number, text: string, where: 'start' | 'end' | 'middle' = 'middle') => (
    <SvgText x={x} y={y} fill="#DDEBE3" fontSize={13} fontFamily={FONT} textAnchor={where}>
      {text}
    </SvgText>
  );

  return (
    <View style={[styles.stage, { height }, style]} accessibilityRole="image" accessibilityLabel={`The grip for a ${hand}-handed batter: ${topName.toLowerCase()} on top, ${bottomName.toLowerCase()} below.`}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Ground, shown when the bat is held ready for the camera. */}
        {stage === 'check' ? <Line x1={40} y1={BLADE.bottom + 4} x2={W - 40} y2={BLADE.bottom + 4} stroke="rgba(255,255,255,0.55)" strokeWidth={3} strokeLinecap="round" /> : null}

        {/* Blade, from behind: the spine runs down the middle. */}
        <Path
          d={`M ${CX - HANDLE.half} ${BLADE.top} L ${CX - BLADE.half} ${BLADE.shoulder} L ${CX - BLADE.half} ${BLADE.bottom - 14} Q ${CX - BLADE.half} ${BLADE.bottom} ${CX - BLADE.half + 14} ${BLADE.bottom} L ${CX + BLADE.half - 14} ${BLADE.bottom} Q ${CX + BLADE.half} ${BLADE.bottom} ${CX + BLADE.half} ${BLADE.bottom - 14} L ${CX + BLADE.half} ${BLADE.shoulder} L ${CX + HANDLE.half} ${BLADE.top} Z`}
          fill={C.willow}
          stroke={C.willowDeep}
          strokeWidth={1.5}
        />
        <Path d={`M ${CX} ${BLADE.shoulder + 36} L ${CX} ${BLADE.bottom - 10}`} stroke={C.willowDeep} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
        {/* The splice, where the handle is fitted into the blade. */}
        <Path d={`M ${CX - HANDLE.half} ${BLADE.top} L ${CX} ${BLADE.shoulder + 40} L ${CX + HANDLE.half} ${BLADE.top}`} stroke={C.willowDeep} strokeWidth={1.5} fill="none" opacity={0.8} />

        {/* Handle with its rubber grip. */}
        <Rect x={CX - HANDLE.half} y={HANDLE.top} width={HANDLE.half * 2} height={HANDLE.bottom - HANDLE.top} rx={8} fill="#1B2B24" />
        {Array.from({ length: 10 }, (_, i) => (
          <Line key={i} x1={CX - HANDLE.half + 2} y1={HANDLE.top + 14 + i * 14} x2={CX + HANDLE.half - 2} y2={HANDLE.top + 14 + i * 14} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
        ))}

        {/* The line the Vs follow: between the middle of the bat and its outside edge. */}
        {showVs ? (
          <>
            <Line x1={CX + out * 19} y1={BOTTOM_HAND_Y + HAND.h} x2={CX + out * 23} y2={BLADE.bottom - 36} stroke={RED} strokeWidth={2.5} strokeDasharray="7 7" strokeLinecap="round" />
            {plain(CX + out * (BLADE.half + 8), BLADE.shoulder + 60, 'Outside', out === 1 ? 'start' : 'end')}
            {plain(CX + out * (BLADE.half + 8), BLADE.shoulder + 76, 'edge', out === 1 ? 'start' : 'end')}
          </>
        ) : null}

        {showBottom ? glove(BOTTOM_HAND_Y, bottomOpacity, stage === 'bottom', pressure ? '#EAF3EE' : GLOVE) : null}
        {showTop ? glove(TOP_HAND_Y, topOpacity, stage === 'top', pressure ? '#BFE8D2' : GLOVE) : null}
        {showVs ? vee(TOP_HAND_Y) : null}
        {showVs ? vee(BOTTOM_HAND_Y) : null}

        {/* Labels */}
        {stage === 'bat' ? (
          <>
            {plain(CX + 30, HANDLE.top + 70, 'Handle', 'start')}
            {plain(CX + BLADE.half + 10, BLADE.shoulder + 70, 'Back of', 'start')}
            {plain(CX + BLADE.half + 10, BLADE.shoulder + 86, 'the bat', 'start')}
            {plain(CX, BLADE.bottom + 20, 'Toe')}
          </>
        ) : null}
        {showTop && stage !== 'pickup' ? label(TOP_HAND_Y + HAND.h / 2, topName, pressure ? 'Hold firmly' : 'Top hand', stage === 'top') : null}
        {showBottom && stage !== 'pickup' && stage !== 'top' ? label(BOTTOM_HAND_Y + HAND.h / 2, bottomName, pressure ? 'Stay relaxed' : 'Bottom hand', stage === 'bottom') : null}

        {/* The small gap between the hands. */}
        {stage === 'bottom' ? <Circle cx={CX + out * (HAND.w / 2 + 12)} cy={(TOP_HAND_Y + HAND.h + BOTTOM_HAND_Y) / 2} r={5} fill={RED} /> : null}
        {stage === 'bottom' ? plain(CX + out * (HAND.w / 2 + 22), (TOP_HAND_Y + HAND.h + BOTTOM_HAND_Y) / 2 - 3, 'Close', out === 1 ? 'start' : 'end') : null}
        {stage === 'bottom' ? plain(CX + out * (HAND.w / 2 + 22), (TOP_HAND_Y + HAND.h + BOTTOM_HAND_Y) / 2 + 13, 'together', out === 1 ? 'start' : 'end') : null}
        {stage === 'check' ? plain(CX, BLADE.bottom + 22, 'Toe on the ground') : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: C.outfield, borderRadius: 22, overflow: 'hidden' },
});
