/**
 * Checks the trained models exported from Google Colab.
 *
 *   npm run test:model                         # every *_model.json in src/lib/pose/models
 *   npx tsx scripts/check-model.ts path/to/stance_model.json
 *
 * For each model:
 *  1. the file is a model this app can use (format, feature version, number of features);
 *  2. parity: on the frames the notebook saved inside the file, the app's features
 *     (src/lib/pose/features.ts) and class probabilities (src/lib/pose/classifier.ts) are the
 *     same as the ones Python computed. The report quotes this as "the phone version of the
 *     model agreed with the Python version on N% of test frames";
 *  3. speed: average time to classify one frame on this computer;
 *  4. the model decides and the rules explain: a predicted fault is spoken first, and a
 *     position the model calls correct counts as good.
 * It also checks the model logic itself on a small hand-made model, so it is useful before any
 * model has been trained.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';

import { checkModel, predictionFrom, predictProba, type PositionModel } from '../src/lib/pose/classifier';
import { extractFeatures, FEATURE_COUNT, FEATURE_NAMES } from '../src/lib/pose/features';
import { buildStance, figureToWorld, idealStance, STANDING } from '../src/lib/pose/idealStance';
import type { Hand, PoseFrame, Vec3 } from '../src/lib/pose/landmarks';
import { LM } from '../src/lib/pose/landmarks';
import { BENCHMARKS_BY_SKILL, type Skill } from '../src/lib/pose/benchmarks';
import { analyzePose, isGoodPosition, judgeWithModel, MODEL_FRONT_VETO, MODEL_KEEP_MARGIN, scoreStance } from '../src/lib/pose/stanceAnalyzer';

let failed = 0;
function expect(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}

// ------------------------------------------------------------------ 1. the logic, on a toy model

const RESTING_BAT = { dx: 0.17, dy: 0.98, hx: 0.5, hy: 0.55, tx: 0.55, ty: 0.85, conf: 0.9, onBody: false };
function frameOf(pose: Vec3[], hand: Hand): PoseFrame {
  const lm: number[] = [];
  for (let i = 0; i < 33; i++) lm.push(0.5, 0.5, 0, 0.99);
  return { t: 0, lm, world: figureToWorld(pose, hand), bat: RESTING_BAT };
}

/**
 * A logistic-regression "model" by hand: it looks only at feet_dist (distance between the ankles
 * in trunk lengths). Feet wider than 0.6 trunk lengths: correct; narrower: feet_too_close.
 */
const feetIndex = FEATURE_NAMES.indexOf('feet_dist');
function toyModel(): PositionModel {
  const mean = new Array(FEATURE_COUNT).fill(0);
  const scale = new Array(FEATURE_COUNT).fill(1);
  const W = Array.from({ length: FEATURE_COUNT }, () => [0, 0]);
  W[feetIndex] = [20, -20];
  return {
    format: 'cricket-coach-model',
    feature_version: 1,
    skill: 'stance',
    type: 'logreg',
    classes: ['correct', 'feet_too_close'],
    correct_class: 'correct',
    scaler: { mean, scale },
    layers: [{ W, b: [-12, 12] }],
    output: 'softmax',
    faults: { feet_too_close: { check: 'feet', dir: 'low' } },
  };
}

/** A model that always says "correct" with probability 0.99: the worst case for the rules' veto. */
function alwaysCorrect(): PositionModel {
  const m = toyModel();
  m.layers = [{ W: Array.from({ length: FEATURE_COUNT }, () => [0, 0]), b: [3, -3] }];
  return m;
}

{
  const model = toyModel();
  expect('toy model is accepted', checkModel(model) === null, String(checkModel(model)));
  for (const hand of ['right', 'left'] as Hand[]) {
    const good = analyzePose('stance', frameOf(idealStance(hand), hand), hand, undefined, { model });
    expect(`${hand}: model judges the model stance correct`, good.state === 'ok' && good.model?.label === 'correct', good.state === 'ok' ? `${good.model?.label} ${good.model?.pCorrect.toFixed(2)}` : good.state);
    expect(`${hand}: a correct position counts as good`, good.state === 'ok' && isGoodPosition(good), good.state === 'ok' ? `score ${good.score}` : '');

    const narrow = idealStance(hand).map((p) => [...p] as Vec3);
    for (const k of [LM.L_ANKLE, LM.L_KNEE, LM.L_HEEL, LM.L_TOE, LM.R_ANKLE, LM.R_KNEE, LM.R_HEEL, LM.R_TOE]) narrow[k][0] *= 0.3;
    const bad = analyzePose('stance', frameOf(narrow, hand), hand, undefined, { model });
    expect(`${hand}: model finds feet too close`, bad.state === 'ok' && bad.model?.label === 'feet_too_close');
    expect(`${hand}: the model's fault is spoken first, with the rule's correction`, bad.state === 'ok' && bad.cues[0]?.id === 'feet' && !!bad.cues[0]?.byModel && /wider/.test(bad.cues[0]?.message ?? ''), bad.state === 'ok' ? String(bad.cues[0]?.message) : '');
    expect(`${hand}: a fault position does not count`, bad.state === 'ok' && !isGoodPosition(bad));

    // The model says correct, the rules disagree (straight legs): both must accept, so it does not count.
    const straight = idealStance(hand).map((p) => [...p] as Vec3);
    for (const [hip, knee, ankle] of [[LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE]]) {
      straight[knee] = [0, 1, 2].map((i) => (straight[hip][i] + straight[ankle][i]) / 2) as Vec3;
    }
    const rulesOnly = analyzePose('stance', frameOf(straight, hand), hand, undefined, { model: null });
    const withModel = analyzePose('stance', frameOf(straight, hand), hand, undefined, { model });
    expect(`${hand}: rules alone reject straight legs`, rulesOnly.state === 'ok' && !isGoodPosition(rulesOnly));
    expect(
      `${hand}: model says correct but the rules reject straight legs: it does not count, the knees correction is spoken`,
      withModel.state === 'ok' && withModel.model?.label === 'correct' && !isGoodPosition(withModel) && withModel.cues.some((c) => c.id === 'knees'),
      withModel.state === 'ok' ? `score ${withModel.score}, cues ${withModel.cues.map((c) => c.id).join(', ')}` : withModel.state,
    );
    // Standing up straight (field test, 16 October 2026) never counts, even if the model accepts it.
    const standing = analyzePose('stance', frameOf(buildStance(hand, STANDING), hand), hand, undefined, { model: alwaysCorrect() });
    expect(`${hand}: standing up straight does not count even when the model says correct`, standing.state === 'ok' && !isGoodPosition(standing),
      standing.state === 'ok' ? `score ${standing.score}, cues ${standing.cues.map((c) => c.id).join(', ')}` : standing.state);
    // A part of a skill (only) is judged by the rules.
    const part = analyzePose('stance', frameOf(narrow, hand), hand, undefined, { model, only: ['knees'] });
    expect(`${hand}: a drill of one part is judged by the rules`, part.state === 'ok' && part.model === undefined);
  }
}

// A model whose faults are merged into one class, "fault" (no link): the worst rule check is said.
{
  const model = toyModel();
  model.classes = ['correct', 'fault'];
  model.faults = {};
  for (const hand of ['right', 'left'] as Hand[]) {
    const narrow = idealStance(hand).map((p) => [...p] as Vec3);
    for (const k of [LM.L_ANKLE, LM.L_KNEE, LM.L_HEEL, LM.L_TOE, LM.R_ANKLE, LM.R_KNEE, LM.R_HEEL, LM.R_TOE]) narrow[k][0] *= 0.3;
    const bad = analyzePose('stance', frameOf(narrow, hand), hand, undefined, { model });
    expect(`${hand}: merged "fault" model: not good, and the worst rule check is said first`, bad.state === 'ok' && !isGoodPosition(bad) && bad.model?.label === 'fault' && bad.cues[0]?.id === 'feet' && !!bad.cues[0]?.byModel, bad.state === 'ok' ? String(bad.cues[0]?.message) : '');
  }
}

// ------------------------------------------------------------------ 2. the exported models

const args = process.argv.slice(2);
const dir = 'src/lib/pose/models';
const files = args.length ? args : existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('_model.json')).map((f) => `${dir}/${f}`) : [];
if (!files.length) console.log('\nNo trained model files yet (src/lib/pose/models/*_model.json). Only the model logic was checked.');

for (const file of files) {
  console.log(`\n${file}`);
  const model = JSON.parse(readFileSync(file, 'utf8')) as PositionModel;
  const problem = checkModel(model);
  expect(`${model.skill}: usable by the app`, problem === null, problem ?? `${model.type}, classes ${model.classes.join(', ')}`);
  if (problem) continue;
  const samples = model.parity ?? [];
  expect(`${model.skill}: has parity frames from the notebook`, samples.length > 0, `${samples.length} frames`);
  let featureMax = 0;
  let probMax = 0;
  let same = 0;
  for (const s of samples) {
    const f = extractFeatures(s.world, s.lm, s.hand, s.aspect);
    featureMax = Math.max(featureMax, ...f.map((v, i) => Math.abs(v - s.features[i]) / Math.max(1, Math.abs(s.features[i]))));
    const p = predictProba(model, f);
    probMax = Math.max(probMax, ...p.map((v, i) => Math.abs(v - s.probs[i])));
    const a = predictionFrom(model, p).index;
    const b = predictionFrom(model, s.probs).index;
    if (a === b) same++;
  }
  if (samples.length) {
    expect(`${model.skill}: features match Python`, featureMax < 1e-6, `largest difference ${featureMax.toExponential(1)}`);
    expect(`${model.skill}: probabilities match Python`, probMax < 1e-4, `largest difference ${probMax.toExponential(1)}`);
    expect(`${model.skill}: same class as Python on every parity frame`, same === samples.length, `${same}/${samples.length} (${((100 * same) / samples.length).toFixed(1)}%)`);
    const runs = 2000;
    const t0 = Date.now();
    for (let i = 0; i < runs; i++) {
      const s = samples[i % samples.length];
      predictProba(model, extractFeatures(s.world, s.lm, s.hand, s.aspect));
    }
    console.log(`      time per frame on this computer: ${((Date.now() - t0) / runs).toFixed(3)} ms (features + model)`);
  }
  if (model.skill === 'stance') {
    for (const hand of ['right', 'left'] as Hand[]) {
      const st = analyzePose('stance', frameOf(buildStance(hand, STANDING), hand), hand, undefined, { model });
      expect(`stance: ${hand}: standing up straight does not count with the trained model`, st.state === 'ok' && !isGoodPosition(st),
        st.state === 'ok' ? `model ${st.model?.label} ${st.model?.pCorrect.toFixed(2)}, score ${st.score}` : st.state);
    }
  }
  for (const c of model.classes) {
    if (c === model.correct_class) continue;
    if (c === 'fault') {
      console.log(`      ${model.skill}: faults merged into one class: the app's rule checks say what to fix`);
      continue;
    }
    expect(`${model.skill}: fault "${c}" has a correction`, !!model.faults?.[c], model.faults?.[c] ? `${model.faults[c].check} ${model.faults[c].dir}` : 'add it to FAULTS in the notebook');
    const link = model.faults?.[c];
    if (link) {
      const checks = (BENCHMARKS_BY_SKILL[model.skill as Skill] ?? []).map((b) => b.id as string);
      expect(`${model.skill}: fault "${c}" is explained by a check of this skill`, checks.includes(link.check), `${link.check} in ${checks.join(', ')}`);
    }
  }
}


// Field test, 19 October 2026: with a probability near the model's threshold, the verdict
// flipped many times a second. A position the model accepted stays accepted until the
// probability falls MODEL_KEEP_MARGIN below the threshold.
{
  const model = { format: 'cricket-coach-model', feature_version: 1, skill: 'stance', classes: ['correct', 'fault'], correct_class: 'correct', good_prob: 0.6, faults: {} } as unknown as PositionModel;
  const rules = scoreStance({ feet: 1.2, knees: 150, lean: 20, shoulders: 3, hands: 0.3 });
  const at = (p: number) => ({ label: p >= 0.5 ? 'correct' : 'fault', index: p >= 0.5 ? 0 : 1, probs: [p, 1 - p], pCorrect: p });
  const fresh = judgeWithModel(rules, BENCHMARKS_BY_SKILL.stance, model, at(0.55), 'right', false);
  const kept = judgeWithModel(rules, BENCHMARKS_BY_SKILL.stance, model, at(0.55), 'right', true);
  const lost = judgeWithModel(rules, BENCHMARKS_BY_SKILL.stance, model, at(0.6 - MODEL_KEEP_MARGIN - 0.02), 'right', true);
  expect('model: 0.55 is not accepted on its own (threshold 0.6)', !fresh.modelAccepted && !isGoodPosition(fresh), `score ${fresh.score}`);
  expect('model: 0.55 keeps a position that was accepted', kept.modelAccepted && isGoodPosition(kept), `score ${kept.score}`);
  expect('model: below the margin, the position is no longer accepted', !lost.modelAccepted && !isGoodPosition(lost), `score ${lost.score}`);
  // Phone at the bowler's end: an unsure "fault" does not overrule rules that accept; a confident one does.
  const side = judgeWithModel(rules, BENCHMARKS_BY_SKILL.stance, model, at(0.45), 'right', false);
  const frontUnsure = judgeWithModel(rules, BENCHMARKS_BY_SKILL.stance, model, at(0.45), 'right', false, MODEL_FRONT_VETO);
  const frontSure = judgeWithModel(rules, BENCHMARKS_BY_SKILL.stance, model, at(MODEL_FRONT_VETO - 0.1), 'right', false, MODEL_FRONT_VETO);
  const badRules = scoreStance({ feet: 1.2, knees: 100, lean: 20, shoulders: 3, hands: 0.3 });
  const frontBadRules = judgeWithModel(badRules, BENCHMARKS_BY_SKILL.stance, model, at(0.45), 'right', false, MODEL_FRONT_VETO);
  expect('model, side: an unsure fault (0.45) does not count', !isGoodPosition(side), `score ${side.score}`);
  expect('model, front: an unsure fault (0.45) with good rules counts, scored by the rules', isGoodPosition(frontUnsure) && frontUnsure.score === rules.score && !!frontUnsure.model?.unsure, `score ${frontUnsure.score}`);
  expect('model, front: a confident fault still does not count', !isGoodPosition(frontSure), `score ${frontSure.score}`);
  expect('model, front: an unsure model does not rescue a position the rules reject', !isGoodPosition(frontBadRules), `score ${frontBadRules.score}`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
if (failed) process.exit(1);
