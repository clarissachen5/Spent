import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN = '#0a542f';
const LIME_GREEN = '#cdf545';
const MINT       = '#d2f3e2';
const BLACK      = '#1e1d19';
const GRAY_TEXT  = '#a5a5a5';
const LIGHT_GRAY = '#eff0f0';
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Food', 'Shopping', 'Coffee', 'Entertainment', 'Transportation', 'Other'];

const GOALS = [
  'Saving for a trip',
  'Going out more',
  'Low income period',
  'Finals week',
  'Eating out less',
  'Building an emergency fund',
];

export default function OnboardingScreen() {
  const { top }  = useSafeAreaInsets();
  const router   = useRouter();
  const { userProfile, profileLoaded, saveUserProfile } = useAuth();

  const [city,       setCity]       = useState('');
  const [school,     setSchool]     = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [goals,      setGoals]      = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);

  // If profile already exists, skip straight to home
  useEffect(() => {
    if (profileLoaded && userProfile) {
      router.replace({ pathname: '/(tabs)/home', params: { checkIn: Date.now().toString() } });
    }
  }, [profileLoaded, userProfile]);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleSubmit = async () => {
    if (!city.trim() || !school.trim()) return;
    setSaving(true);
    try {
      await saveUserProfile({ city: city.trim(), school: school.trim(), categories, goals });
      router.replace({ pathname: '/(tabs)/home', params: { checkIn: Date.now().toString() } });
    } finally {
      setSaving(false);
    }
  };

  // Show spinner while we check if profile exists
  if (!profileLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={DARK_GREEN} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: top + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <Text style={styles.title}>Welcome to Spent</Text>
        <Text style={styles.subtitle}>
          Tell us a bit about yourself so we can personalize your spending insights.
        </Text>

        {/* ── City ── */}
        <Text style={styles.sectionLabel}>What city do you live in?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Boston"
          placeholderTextColor={GRAY_TEXT}
          value={city}
          onChangeText={setCity}
          autoCorrect={false}
        />

        {/* ── School ── */}
        <Text style={styles.sectionLabel}>Where do you go to school?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Northeastern University"
          placeholderTextColor={GRAY_TEXT}
          value={school}
          onChangeText={setSchool}
          autoCorrect={false}
        />

        {/* ── Categories ── */}
        <Text style={styles.sectionLabel}>What do you spend on?</Text>
        <Text style={styles.sectionHint}>Select categories to track on your dashboard.</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(cat => {
            const selected = categories.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleItem(categories, setCategories, cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Goals ── */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>What are your spending goals?</Text>
        <Text style={styles.sectionHint}>Select all that apply.</Text>
        <View style={styles.chipRow}>
          {GOALS.map(goal => {
            const selected = goals.includes(goal);
            return (
              <TouchableOpacity
                key={goal}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleItem(goals, setGoals, goal)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{goal}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!city.trim() || !school.trim() || saving) && styles.submitDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!city.trim() || !school.trim() || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={DARK_GREEN} />
            : <Text style={styles.submitText}>Get Started</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_GREEN,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: GRAY_TEXT,
    lineHeight: 20,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
    marginTop: 16,
  },
  sectionHint: {
    fontSize: 12,
    color: GRAY_TEXT,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: MINT,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: BLACK,
    backgroundColor: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: LIGHT_GRAY,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: DARK_GREEN,
    borderColor: DARK_GREEN,
  },
  chipText: {
    fontSize: 13,
    color: BLACK,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: LIME_GREEN,
  },
  submitButton: {
    marginTop: 36,
    backgroundColor: LIME_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK_GREEN,
  },
});
