import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, Rect, Text as SvgText } from 'react-native-svg';

import { Button, Card, Choice, H3, P, Screen, Small, TopBar } from '@/components/ui';
import { BOWLER_Y, STRIKER_Y, fieldPositions, type FieldPosition } from '@/data/fieldPositions';
import { makeFieldQuestions, type FieldQuestion } from '@/data/fieldQuestions';
import type { Hand } from '@/lib/pose/landmarks';
import { useProfile } from '@/state/AuthContext';
import { C, F, sp } from '@/theme';

type Mode = 'learn' | 'quiz' | 'read';

function shuffled<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FieldTrainer() {
  const profile = useProfile();
  const hand = profile.battingHand;
  const positions = useMemo(() => fieldPositions(hand), [hand]);

  const [mode, setMode] = useState<Mode>('learn');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<FieldPosition | null>(null);

  // Quiz state
  const [order, setOrder] = useState<FieldPosition[]>(() => shuffled(positions));
  const [turn, setTurn] = useState(0);
  const [tapped, setTapped] = useState<FieldPosition | null>(null);
  const [right, setRight] = useState(0);

  const target = order[turn];
  const finished = mode === 'quiz' && turn >= order.length;

  const startQuiz = () => {
    setOrder(shuffled(positions));
    setTurn(0);
    setTapped(null);
    setRight(0);
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    if (m === 'quiz') startQuiz();
  };

  const tap = (p: FieldPosition) => {
    if (mode === 'learn') {
      setSelected(p.id === selected?.id ? null : p);
      return;
    }
    if (tapped || finished) return;
    setTapped(p);
    if (p.id === target.id) setRight((r) => r + 1);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const height = width * 1.12;
  const rx = width / 2 - 6;
  const ry = height / 2 - 6;
  const px = (x: number) => width / 2 + x * rx;
  const py = (y: number) => height / 2 + y * ry;
  const offLeft = hand === 'right';

  const colourOf = (p: FieldPosition) => {
    if (mode === 'learn') return p.id === selected?.id ? C.ball : '#FFFFFF';
    if (!tapped) return '#FFFFFF';
    if (p.id === target.id) return '#5BE49B';
    if (p.id === tapped.id) return '#FF8A8D';
    return '#FFFFFF';
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <TopBar title="Field trainer" />
      <Choice
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'learn', label: 'Learn the positions' },
          { value: 'quiz', label: 'Test myself' },
          { value: 'read', label: 'Read the field' },
        ]}
      />
      {mode === 'read' ? <ReadTheField /> : null}

      {mode === 'quiz' && !finished ? (
        <View>
          <Small>
            Position {turn + 1} of {order.length}
          </Small>
          <Text style={styles.prompt}>Tap {target.name}</Text>
        </View>
      ) : null}

      {mode !== 'read' ? (
      <View onLayout={onLayout} style={{ width: '100%' }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Ellipse cx={width / 2} cy={height / 2} rx={rx} ry={ry} fill={C.outfield} />
            <Ellipse cx={width / 2} cy={height / 2} rx={rx * 0.5} ry={ry * 0.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="6 6" />
            <Rect x={width / 2 - 9} y={py(STRIKER_Y) - 4} width={18} height={py(BOWLER_Y) - py(STRIKER_Y) + 8} rx={2} fill={C.pitch} />
            <SvgText fontFamily="System" x={px(offLeft ? -0.62 : 0.62)} y={py(-0.42)} fill="#FFFFFF" fillOpacity={0.75} fontSize={13} textAnchor="middle">
              Off side
            </SvgText>
            <SvgText fontFamily="System" x={px(offLeft ? 0.62 : -0.62)} y={py(-0.42)} fill="#FFFFFF" fillOpacity={0.75} fontSize={13} textAnchor="middle">
              Leg side
            </SvgText>
            {/* Batter and bowler */}
            <Circle cx={width / 2} cy={py(STRIKER_Y)} r={6} fill={C.willow} stroke={C.ink} strokeWidth={1.5} />
            <SvgText fontFamily="System" x={width / 2 + 14} y={py(STRIKER_Y) + 4} fill="#FFFFFF" fontSize={12}>
              You
            </SvgText>
            <Circle cx={width / 2} cy={py(BOWLER_Y) + 10} r={5} fill={C.ball} stroke="#FFFFFF" strokeWidth={1.5} />
            <SvgText fontFamily="System" x={width / 2 + 14} y={py(BOWLER_Y) + 14} fill="#FFFFFF" fontSize={12}>
              Bowler
            </SvgText>
            {positions.map((p) => (
              <Circle key={p.id} cx={px(p.x)} cy={py(p.y)} r={9} fill={colourOf(p)} stroke={C.ink} strokeWidth={1.5} />
            ))}
            {/* Larger tap targets */}
            {positions.map((p) => (
              <Circle key={`t-${p.id}`} cx={px(p.x)} cy={py(p.y)} r={22} fill="transparent" onPress={() => tap(p)} />
            ))}
            {mode === 'learn' && selected ? (
              <SvgText fontFamily="System" x={px(selected.x)} y={py(selected.y) - 16} fill="#FFFFFF" fontSize={14} fontWeight="bold" textAnchor="middle">
                {selected.name}
              </SvgText>
            ) : null}
            {mode === 'quiz' && tapped && !finished ? (
              <SvgText fontFamily="System" x={px(target.x)} y={py(target.y) - 16} fill="#FFFFFF" fontSize={14} fontWeight="bold" textAnchor="middle">
                {target.name}
              </SvgText>
            ) : null}
          </Svg>
        ) : null}
      </View>
      ) : null}

      {mode === 'learn' ? (
        <Card>
          {selected ? (
            <>
              <H3>{selected.name}</H3>
              <P soft>{selected.about}</P>
            </>
          ) : (
            <P soft>
              Tap a fielder to see the name of the position. The field is drawn for a {hand}-handed batter, so your off side is on the {offLeft ? 'left' : 'right'} of the picture.
            </P>
          )}
        </Card>
      ) : null}

      {mode === 'quiz' && !finished && tapped ? (
        <Card>
          <H3>{tapped.id === target.id ? 'Correct' : `That is ${tapped.name}`}</H3>
          <P soft>{target.about}</P>
          <Button
            title={turn + 1 < order.length ? 'Next position' : 'See my result'}
            onPress={() => {
              setTapped(null);
              setTurn(turn + 1);
            }}
          />
        </Card>
      ) : null}

      {finished ? (
        <Card>
          <Text style={styles.result}>
            {right} of {order.length}
          </Text>
          <P soft>{right === order.length ? 'Every position right.' : 'Go through the positions again, then have another try.'}</P>
          <Button title="Test myself again" onPress={startQuiz} />
        </Card>
      ) : null}
    </Screen>
  );
}

/**
 * "Read the field": questions about a field drawn for a batter whose hand is not given, so the
 * learner has to work it out from where the fielders stand (for example the slips are always on
 * the batter's off side), and questions about which fielder is placed for which shot.
 */
function ReadTheField() {
  const [questions, setQuestions] = useState<FieldQuestion[]>(() => makeFieldQuestions());
  const [turn, setTurn] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [width, setWidth] = useState(0);
  const q = questions[turn];
  const finished = turn >= questions.length;

  const restart = () => {
    setQuestions(makeFieldQuestions());
    setTurn(0);
    setPicked(null);
    setRight(0);
  };

  if (finished) {
    return (
      <Card>
        <Text style={styles.result}>
          {right} of {questions.length}
        </Text>
        <P soft>{right === questions.length ? 'You can read a field. Well done.' : 'Look again at where the slips stand and which side is the off side, then try again.'}</P>
        <Button title="New questions" onPress={restart} />
      </Card>
    );
  }

  return (
    <View style={{ gap: sp(3) }}>
      <View>
        <Small>
          Question {turn + 1} of {questions.length}
        </Small>
        <Text style={styles.question}>{q.q}</Text>
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
        {width > 0 ? <FieldPicture width={width} hand={q.hand} show={q.show} highlight={q.highlight} sides={q.sides} batterLabel={q.batterLabel} /> : null}
      </View>
      <View style={{ gap: sp(2) }}>
        {q.options.map((o, i) => {
          const kind = picked === null ? 'secondary' : i === q.answer ? 'primary' : i === picked ? 'danger' : 'ghost';
          return (
            <Button
              key={o}
              title={picked !== null && i === q.answer ? `✓ ${o}` : o}
              kind={kind}
              onPress={() => {
                if (picked !== null) return;
                setPicked(i);
                if (i === q.answer) setRight((r) => r + 1);
              }}
            />
          );
        })}
      </View>
      {picked !== null ? (
        <Card>
          <H3>{picked === q.answer ? 'Correct' : 'Not quite'}</H3>
          <P soft>{q.why}</P>
          <Button
            title={turn + 1 < questions.length ? 'Next question' : 'See my result'}
            onPress={() => {
              setPicked(null);
              setTurn(turn + 1);
            }}
          />
        </Card>
      ) : null}
    </View>
  );
}

/** A field seen from behind the bowler, for a batter of the given hand. */
function FieldPicture({
  width,
  hand,
  show,
  highlight,
  sides,
  batterLabel,
}: {
  width: number;
  hand: Hand;
  show: string[];
  highlight: string[];
  sides: boolean;
  batterLabel: string;
}) {
  const positions = fieldPositions(hand).filter((p) => show.includes(p.id));
  const height = width * 1.12;
  const rx = width / 2 - 6;
  const ry = height / 2 - 6;
  const px = (x: number) => width / 2 + x * rx;
  const py = (y: number) => height / 2 + y * ry;
  const offLeft = hand === 'right';
  return (
    <Svg width={width} height={height}>
      <Ellipse cx={width / 2} cy={height / 2} rx={rx} ry={ry} fill={C.outfield} />
      <Ellipse cx={width / 2} cy={height / 2} rx={rx * 0.5} ry={ry * 0.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="6 6" />
      <Rect x={width / 2 - 9} y={py(STRIKER_Y) - 4} width={18} height={py(BOWLER_Y) - py(STRIKER_Y) + 8} rx={2} fill={C.pitch} />
      {sides ? (
        <>
          <SvgText fontFamily="System" x={px(offLeft ? -0.62 : 0.62)} y={py(-0.42)} fill="#FFFFFF" fillOpacity={0.75} fontSize={13} textAnchor="middle">
            Off side
          </SvgText>
          <SvgText fontFamily="System" x={px(offLeft ? 0.62 : -0.62)} y={py(-0.42)} fill="#FFFFFF" fillOpacity={0.75} fontSize={13} textAnchor="middle">
            Leg side
          </SvgText>
        </>
      ) : null}
      <Circle cx={width / 2} cy={py(STRIKER_Y)} r={6} fill={C.willow} stroke={C.ink} strokeWidth={1.5} />
      <SvgText fontFamily="System" x={width / 2 + 14} y={py(STRIKER_Y) + 4} fill="#FFFFFF" fontSize={12}>
        {batterLabel}
      </SvgText>
      <Circle cx={width / 2} cy={py(BOWLER_Y) + 10} r={5} fill={C.ball} stroke="#FFFFFF" strokeWidth={1.5} />
      <SvgText fontFamily="System" x={width / 2 + 14} y={py(BOWLER_Y) + 14} fill="#FFFFFF" fontSize={12}>
        Bowler
      </SvgText>
      {positions.map((p) => (
        <Circle key={p.id} cx={px(p.x)} cy={py(p.y)} r={9} fill={highlight.includes(p.id) ? C.ball : '#FFFFFF'} stroke={C.ink} strokeWidth={1.5} />
      ))}
      {positions
        .filter((p) => highlight.includes(p.id))
        .map((p) => (
          <SvgText key={`l-${p.id}`} fontFamily="System" x={px(p.x)} y={py(p.y) - 14} fill="#FFFFFF" fontSize={12} fontWeight="bold" textAnchor="middle">
            {p.name}
          </SvgText>
        ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  question: { fontFamily: F.display, fontSize: 24, lineHeight: 28, color: C.ink, marginTop: sp(0.5) },
  prompt: { fontFamily: F.display, fontSize: 30, color: C.ink, marginTop: sp(0.5) },
  result: { fontFamily: F.displayBold, fontSize: 56, color: C.ink },
});
