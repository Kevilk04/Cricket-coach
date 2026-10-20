/**
 * Checks the learning content added in the sixteenth round:
 *  - the dismissals lesson covers all 11 ways of being out, and every quiz answer is valid;
 *  - "Read the field" questions: valid answers, and the batter's hand really follows from where
 *    the slip is drawn (seen from behind the bowler, a right-hander's slip is on the left);
 *  - the stance comes first: other practices open only after STANCE_FIRST_REPS good stances.
 */
import { LESSONS } from '../src/data/curriculum';
import { fieldPositions } from '../src/data/fieldPositions';
import { makeFieldQuestions } from '../src/data/fieldQuestions';
import { STANCE_FIRST_REPS, stanceRepsDone } from '../src/data/training';

let failed = 0;
function expect(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}

const d = LESSONS.find((l) => l.id === 'dismissals')!;
const ways = ['Bowled', 'Caught', 'Leg before wicket', 'Run out', 'Stumped', 'Hit wicket', 'Hit the ball twice', 'Obstructing the field', 'Handled the ball', 'Timed out', 'Retired out'];
const headings = d.sections.map((s) => s.heading);
expect('dismissals lesson names all 11 ways', ways.every((w) => headings.some((h) => h.includes(w))), headings.filter((h) => /^\d+\./.test(h)).length + ' numbered sections');
let quizOk = true;
for (const l of LESSONS) for (const q of l.quiz) {
  const idx = typeof q.answer === 'number' ? [q.answer] : [q.answer.right, q.answer.left];
  if (idx.some((i) => i < 0 || i >= q.options.length)) quizOk = false;
}
expect('every lesson quiz answer points at an option', quizOk);
expect('dismissals quiz has 10 or more questions', d.quiz.length >= 10, `${d.quiz.length} questions`);

let valid = true, handOk = true, both = new Set<string>(), seen = 0;
for (let k = 0; k < 300; k++) {
  for (const q of makeFieldQuestions()) {
    seen++;
    if (q.answer < 0 || q.answer >= q.options.length || new Set(q.options).size !== q.options.length) valid = false;
    if (q.options[0] === 'Right-handed batter') {
      both.add(q.hand);
      const slip = fieldPositions(q.hand).find((p) => p.id === 'slip')!;
      const slipLeft = slip.x < 0; // drawn left of the keeper
      const said = q.answer === 0 ? 'right' : 'left';
      if ((slipLeft ? 'right' : 'left') !== said) handOk = false;
      if (q.sides) handOk = false; // the side labels would give the answer away
    }
  }
}
expect('field questions: answers valid, no repeated options', valid, `${seen} questions`);
expect('field questions: the batter’s hand follows from the slip’s side', handOk);
expect('field questions: both right- and left-handed fields are asked', both.size === 2);

const rep = (at: number) => ({ at, score: 90 });
const stance = (n: number) => ({ id: 's', kind: 'stance', score: 90, at: 0, reps: Array.from({ length: n }, (_, i) => rep(i)) }) as any;
expect(`stance first: ${STANCE_FIRST_REPS - 1} good stances are not enough`, stanceRepsDone([stance(STANCE_FIRST_REPS - 1)]) < STANCE_FIRST_REPS);
expect(`stance first: ${STANCE_FIRST_REPS} good stances open the shots`, stanceRepsDone([stance(4), stance(STANCE_FIRST_REPS - 4)]) >= STANCE_FIRST_REPS);
expect('stance first: shot practice does not count as stance', stanceRepsDone([{ ...stance(20), kind: 'defence' }]) === 0);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll content checks passed');
if (failed) process.exit(1);
