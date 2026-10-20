import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Choice, H2, H3, Notice, P, Screen, Small, TopBar } from '@/components/ui';
import type { Hand } from '@/lib/pose/landmarks';
import { firebaseConfigured } from '@/services/backend';
import { coachConfigured } from '@/services/coach';
import { clearSnapshots } from '@/services/snapshots';
import { useAuth, useProfile } from '@/state/AuthContext';
import { useData } from '@/state/DataContext';
import { C, sp } from '@/theme';

const EXPERIENCE = { new: 'New to cricket', some: 'Plays with friends', club: 'School or club player' } as const;

export default function Profile() {
  const profile = useProfile();
  const { updateProfile, signOut } = useAuth();
  const { stepsOpen, setStepsOpen } = useData();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const changeHand = async (hand: Hand) => {
    setError(null);
    try {
      await updateProfile({ battingHand: hand });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <TopBar title="Profile" />
      <View style={{ gap: sp(1) }}>
        <H2>{profile.name}</H2>
        <Small>{profile.email}</Small>
      </View>

      <Card>
        <H3>Batting hand</H3>
        <Choice
          value={profile.battingHand}
          onChange={changeHand}
          options={[
            { value: 'left', label: 'Left-handed' },
            { value: 'right', label: 'Right-handed' },
          ]}
        />
        <Small>Lessons, demonstrations and the camera checks follow this.</Small>
        {error ? <Text style={{ color: C.bad }}>{error}</Text> : null}
      </Card>

      <Card>
        <H3>About you</H3>
        <P soft>Age {profile.ageGroup.replace('-', ' to ')}</P>
        <P soft>{EXPERIENCE[profile.experience]}</P>
        {profile.goal ? <P soft>Goal: {profile.goal}</P> : null}
        {profile.guardianName ? <P soft>Parent or guardian: {profile.guardianName}</P> : null}
      </Card>

      <Card>
        <H3>Practice order</H3>
        <Choice
          value={stepsOpen ? 'open' : 'order'}
          onChange={(v) => setStepsOpen(v === 'open')}
          options={[
            { value: 'order', label: 'One step at a time' },
            { value: 'open', label: 'All steps open' },
          ]}
        />
        <Small>Normally a step opens when the one before it is passed. A coach or teacher can open every step for a learner the camera cannot judge well.</Small>
      </Card>

      <Button title="How to use the app" icon="help-circle" kind="secondary" onPress={() => router.push('/how-to')} />
      <Button title="Coach test (check the app against a coach)" icon="ribbon" kind="secondary" onPress={() => router.push('/coach-test')} />

      <Notice icon={firebaseConfigured ? 'cloud-done' : 'phone-portrait'}>
        {firebaseConfigured ? 'Your progress is saved to your account.' : 'Demo mode: your progress is saved on this phone only. Add Firebase keys to .env to save it to an account.'}
      </Notice>
      <Notice icon={coachConfigured ? 'chatbubbles' : 'chatbubbles-outline'}>
        {coachConfigured ? 'The AI coach is connected.' : 'The AI coach is not connected. The Coach tab answers from tips stored in the app.'}
      </Notice>

      <Button
        title="Sign out"
        kind="secondary"
        icon="log-out-outline"
        loading={leaving}
        onPress={async () => {
          setLeaving(true);
          // Photos of practice attempts belong to this learner, so they go when the learner signs out.
          await clearSnapshots();
          await signOut();
        }}
      />
    </Screen>
  );
}
