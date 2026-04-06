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

export default function SettingsScreen() {
  const { top }  = useSafeAreaInsets();
  const router   = useRouter();
  const { logout, userProfile, saveUserProfile } = useAuth();

  const [city,       setCity]       = useState('');
  const [school,     setSchool]     = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [goals,      setGoals]      = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  // Populate fields from loaded profile
  useEffect(() => {
    if (userProfile) {
      setCity(userProfile.city);
      setSchool(userProfile.school);
      setCategories(userProfile.categories);
      setGoals(userProfile.goals);
    }
  }, [userProfile]);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const handleSave = async () => {
    if (!city.trim() || !school.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveUserProfile({ city: city.trim(), school: school.trim(), categories, goals });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/(tabs)/signup');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Settings</Text>

        {/* ── Profile section ── */}
        <Text style={styles.sectionHeader}>Profile</Text>

        <Text style={styles.fieldLabel}>City</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Boston"
          placeholderTextColor={GRAY_TEXT}
          value={city}
          onChangeText={setCity}
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>School</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Northeastern University"
          placeholderTextColor={GRAY_TEXT}
          value={school}
          onChangeText={setSchool}
          autoCorrect={false}
        />

        {/* ── Spending categories ── */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Spending Categories</Text>
        <Text style={styles.fieldHint}>Shown as sliders on your dashboard.</Text>
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

        {/* ── Spending goals ── */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Spending Goals</Text>
        <Text style={styles.fieldHint}>Helps personalize your spending predictions.</Text>
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

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            (!city.trim() || !school.trim() || saving) && styles.btnDisabled,
            saved && styles.saveBtnConfirmed,
          ]}
          onPress={handleSave}
          disabled={!city.trim() || !school.trim() || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={DARK_GREEN} />
            : <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Changes'}</Text>
          }
        </TouchableOpacity>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_GREEN,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: GRAY_TEXT,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BLACK,
    marginTop: 8,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: GRAY_TEXT,
    marginBottom: 6,
    marginTop: -2,
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
  saveBtn: {
    marginTop: 28,
    backgroundColor: LIME_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnConfirmed: {
    backgroundColor: MINT,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK_GREEN,
  },
  logoutBtn: {
    marginTop: 12,
    backgroundColor: DARK_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: LIME_GREEN,
  },
});
