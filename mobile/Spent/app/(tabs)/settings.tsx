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
import MonthlySummaryModal from '../../components/MonthlySummaryModal';

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN = '#0a542f';
const LIME_GREEN = '#cdf545';
const MINT       = '#d2f3e2';
const BLACK      = '#1e1d19';
const GRAY_TEXT  = '#a5a5a5';
const LIGHT_GRAY = '#eff0f0';
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_CATEGORIES = ['Food', 'Shopping', 'Coffee', 'Entertainment', 'Transportation', 'Other'];

const PRESET_GOALS = [
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

  const [city,            setCity]            = useState('');
  const [school,          setSchool]          = useState('');
  const [allCategories,   setAllCategories]   = useState([...PRESET_CATEGORIES]);
  const [categories,      setCategories]      = useState<string[]>([]);
  const [customCatInput,  setCustomCatInput]  = useState('');
  const [allGoals,        setAllGoals]        = useState([...PRESET_GOALS]);
  const [goals,           setGoals]           = useState<string[]>([]);
  const [customGoalInput, setCustomGoalInput] = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [showSummary,     setShowSummary]     = useState(false);

  // Populate fields from loaded profile, restoring any custom items
  useEffect(() => {
    if (userProfile) {
      setCity(userProfile.city);
      setSchool(userProfile.school);

      const customCats = userProfile.categories.filter(c => !PRESET_CATEGORIES.includes(c));
      setAllCategories([...PRESET_CATEGORIES, ...customCats]);
      setCategories(userProfile.categories);

      const customGoals = userProfile.goals.filter(g => !PRESET_GOALS.includes(g));
      setAllGoals([...PRESET_GOALS, ...customGoals]);
      setGoals(userProfile.goals);
    }
  }, [userProfile]);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const addCustomCategory = () => {
    const val = customCatInput.trim();
    if (!val || allCategories.map(c => c.toLowerCase()).includes(val.toLowerCase())) return;
    setAllCategories(prev => [...prev, val]);
    setCategories(prev => [...prev, val]);
    setCustomCatInput('');
  };

  const addCustomGoal = () => {
    const val = customGoalInput.trim();
    if (!val || allGoals.map(g => g.toLowerCase()).includes(val.toLowerCase())) return;
    setAllGoals(prev => [...prev, val]);
    setGoals(prev => [...prev, val]);
    setCustomGoalInput('');
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
          {allCategories.map(cat => {
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
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add your own..."
            placeholderTextColor={GRAY_TEXT}
            value={customCatInput}
            onChangeText={setCustomCatInput}
            onSubmitEditing={addCustomCategory}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustomCategory} activeOpacity={0.7}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* ── Spending goals ── */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Spending Goals</Text>
        <Text style={styles.fieldHint}>Helps personalize your spending predictions.</Text>
        <View style={styles.chipRow}>
          {allGoals.map(goal => {
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
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add your own..."
            placeholderTextColor={GRAY_TEXT}
            value={customGoalInput}
            onChangeText={setCustomGoalInput}
            onSubmitEditing={addCustomGoal}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCustomGoal} activeOpacity={0.7}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* ── Monthly summary ── */}
        <TouchableOpacity
          style={styles.summaryBtn}
          onPress={() => setShowSummary(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.summaryBtnText}>This Month's Summary</Text>
        </TouchableOpacity>

        <MonthlySummaryModal visible={showSummary} onClose={() => setShowSummary(false)} />

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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: LIGHT_GRAY,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: BLACK,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DARK_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 20,
    color: LIME_GREEN,
    lineHeight: 22,
  },
  summaryBtn: {
    marginTop: 28,
    backgroundColor: DARK_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  summaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: LIME_GREEN,
  },
  saveBtn: {
    marginTop: 12,
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
