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
  Image,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN  = '#0a542f';
const LIME_GREEN  = '#cdf545';
const MINT        = '#d2f3e2';
const BLACK       = '#1e1d19';
const GRAY_TEXT   = '#a5a5a5';
const SAVINGS_BG  = '#eef9d6';
const PILL_BG     = '#f4faf2';
const EDIT_BG     = '#ececec';

// Font family aliases
const FONT_REG    = 'SpaceGrotesk_400Regular';
const FONT_MED    = 'SpaceGrotesk_500Medium';
const FONT_SEMI   = 'SpaceGrotesk_600SemiBold';
const FONT_BOLD   = 'SpaceGrotesk_700Bold';

// Pastel category palette
const CATEGORY_META: Record<string, { bg: string; icon?: any }> = {
  Food:           { bg: '#d6ecec', icon: require('../../assets/icons/foodIcon.svg') },
  Coffee:         { bg: '#fbdfe2', icon: require('../../assets/icons/coffeeIcon.svg') },
  Entertainment:  { bg: '#e6dffb', icon: require('../../assets/icons/entertainmentIcon.svg') },
  Shopping:       { bg: '#fdf0c8', icon: require('../../assets/icons/shoppingIcon.svg') },
  Other:          { bg: '#fbe0d8', icon: require('../../assets/icons/otherIcon.svg') },
  Transportation: { bg: '#d8e9fb', icon: require('../../assets/icons/transportationIcon.svg') },
  Groceries:      { bg: '#e2f1d4', icon: require('../../assets/icons/bagIcon.svg') },
  'Eating Out':   { bg: '#d6ecec', icon: require('../../assets/icons/foodIcon.svg') },
};
const FALLBACK_BG = '#f0f0f0';

const PIG = require('../../assets/images/pig.png');

const PRESET_CATEGORIES = ['Food', 'Shopping', 'Coffee', 'Entertainment', 'Transportation', 'Other'];

export default function SettingsScreen() {
  const { top }  = useSafeAreaInsets();
  const router   = useRouter();
  const { logout, userProfile, saveUserProfile, checkInResults } = useAuth();

  const [city,            setCity]            = useState('');
  const [school,          setSchool]          = useState('');
  const [allCategories,   setAllCategories]   = useState([...PRESET_CATEGORIES]);
  const [categories,      setCategories]      = useState<string[]>([]);
  const [customCatInput,  setCustomCatInput]  = useState('');
  const [showCatInput,    setShowCatInput]    = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  useEffect(() => {
    if (userProfile) {
      setCity(userProfile.city);
      setSchool(userProfile.school);

      const customCats = userProfile.categories.filter(c => !PRESET_CATEGORIES.includes(c));
      setAllCategories([...PRESET_CATEGORIES, ...customCats]);
      setCategories(userProfile.categories);
    }
  }, [userProfile]);

  // Approximate "saved with Spent" — sum of declined check-ins
  const savedAmount = Math.round(
    checkInResults
      .filter(r => !r.visited && typeof r.amount === 'number')
      .reduce((acc, r) => acc + (r.amount ?? 0), 0)
  );

  const displayName = userProfile?.userName?.trim() || 'Your Name';
  const displayAge  = userProfile?.userAge ? `${userProfile.userAge} years old` : '';

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const addCustomCategory = () => {
    const val = customCatInput.trim();
    if (!val || allCategories.map(c => c.toLowerCase()).includes(val.toLowerCase())) return;
    setAllCategories(prev => [...prev, val]);
    setCategories(prev => [...prev, val]);
    setCustomCatInput('');
    setShowCatInput(false);
  };

  const handleSave = async () => {
    if (!city.trim() || !school.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveUserProfile({
        ...(userProfile ?? { categories: [], goals: [] }),
        city: city.trim(),
        school: school.trim(),
        categories,
        goals: userProfile?.goals ?? [],
      });
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

  const visibleCategories = categories.length > 0 ? categories : allCategories;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Savings card ── */}
        <View style={styles.savingsCard}>
          <View style={styles.savingsAmountRow}>
            <Text style={styles.savingsDollar}>$</Text>
            <Text style={styles.savingsAmount}>{savedAmount}</Text>
          </View>
          <Text style={styles.savingsCaption}>saved with Spent</Text>
          <Image source={PIG} style={styles.savingsPig} resizeMode="contain" />
        </View>

        {/* ── Name + Edit Profile row ── */}
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nameText}>{displayName}</Text>
            {!!displayAge && <Text style={styles.ageText}>{displayAge}</Text>}
          </View>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Location ── */}
        <Text style={styles.fieldLabel}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Boston, Massachusetts"
          placeholderTextColor={GRAY_TEXT}
          value={city}
          onChangeText={setCity}
          autoCorrect={false}
        />

        {/* ── School ── */}
        <Text style={styles.fieldLabel}>School</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Boston University"
          placeholderTextColor={GRAY_TEXT}
          value={school}
          onChangeText={setSchool}
          autoCorrect={false}
        />

        {/* ── Dashboard categories pill ── */}
        <View style={styles.categoryPillWrap}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>DASHBOARD CATEGORIES</Text>
          </View>
        </View>

        {/* ── Category grid (3 columns) ── */}
        <View style={styles.grid}>
          {visibleCategories.map(cat => {
            const meta = CATEGORY_META[cat] ?? { bg: FALLBACK_BG };
            const selected = categories.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.85}
                onPress={() => toggleItem(categories, setCategories, cat)}
                style={styles.tileWrap}
              >
                <View
                  style={[
                    styles.tile,
                    { backgroundColor: meta.bg },
                    !selected && styles.tileUnselected,
                  ]}
                >
                  {meta.icon ? (
                    <ExpoImage source={meta.icon} style={styles.tileIcon} contentFit="contain" />
                  ) : (
                    <View style={styles.tileIcon} />
                  )}
                  <Text style={styles.tileLabel} numberOfLines={1}>{cat}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Add tile */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowCatInput(v => !v)}
            style={styles.tileWrap}
          >
            <View style={[styles.tile, styles.addTile]}>
              <View style={styles.addCircle}>
                <Text style={styles.addCirclePlus}>+</Text>
              </View>
              <Text style={styles.tileLabel}>Add</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showCatInput && (
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="New category name..."
              placeholderTextColor={GRAY_TEXT}
              value={customCatInput}
              onChangeText={setCustomCatInput}
              onSubmitEditing={addCustomCategory}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomCategory} activeOpacity={0.7}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Save / Log out ── */}
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
    paddingBottom: 120,
  },

  // Savings card
  savingsCard: {
    backgroundColor: SAVINGS_BG,
    borderRadius: 18,
    paddingTop: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 18,
  },
  savingsAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  savingsAmount: {
    fontFamily: FONT_BOLD,
    fontSize: 44,
    lineHeight: 48,
    color: DARK_GREEN,
    letterSpacing: -1,
  },
  savingsDollar: {
    fontFamily: FONT_SEMI,
    fontSize: 26,
    lineHeight: 30,
    color: DARK_GREEN,
    marginTop: 4,
    marginRight: 2,
  },
  savingsCaption: {
    fontFamily: FONT_MED,
    fontSize: 13,
    color: DARK_GREEN,
    marginTop: -2,
    opacity: 0.85,
  },
  savingsPig: {
    width: 220,
    height: 150,
    marginTop: 8,
    marginBottom: -30,
  },

  // Name row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  nameText: {
    fontFamily: FONT_BOLD,
    fontSize: 22,
    color: BLACK,
  },
  ageText: {
    fontFamily: FONT_REG,
    fontSize: 13,
    color: GRAY_TEXT,
    marginTop: 2,
  },
  editBtn: {
    backgroundColor: EDIT_BG,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  editBtnText: {
    fontFamily: FONT_MED,
    fontSize: 13,
    color: '#6f6f6f',
  },

  // Inputs
  fieldLabel: {
    fontFamily: FONT_SEMI,
    fontSize: 14,
    color: BLACK,
    marginTop: 4,
    marginBottom: 6,
  },
  input: {
    fontFamily: FONT_REG,
    borderWidth: 1.2,
    borderColor: '#e4e6e6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: BLACK,
    backgroundColor: '#fff',
    marginBottom: 14,
  },

  // Dashboard Categories pill
  categoryPillWrap: {
    marginTop: 12,
    marginBottom: 14,
    flexDirection: 'row',
  },
  categoryPill: {
    borderWidth: 1.3,
    borderColor: DARK_GREEN,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: PILL_BG,
  },
  categoryPillText: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: DARK_GREEN,
    letterSpacing: 0.6,
  },

  // Category grid (3 columns via percentage)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileWrap: {
    width: '33.3333%',
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tileUnselected: {
    opacity: 0.5,
  },
  tileIcon: {
    width: 34,
    height: 34,
    marginBottom: 6,
  },
  tileLabel: {
    fontFamily: FONT_SEMI,
    fontSize: 12,
    color: BLACK,
    textAlign: 'center',
  },
  addTile: {
    backgroundColor: '#fff',
    borderWidth: 1.3,
    borderColor: '#e4e6e6',
  },
  addCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.3,
    borderColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addCirclePlus: {
    fontFamily: FONT_REG,
    fontSize: 20,
    color: BLACK,
    lineHeight: 22,
  },

  // Add custom category row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  addInput: {
    flex: 1,
    fontFamily: FONT_REG,
    borderWidth: 1.5,
    borderColor: '#eff0f0',
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
    fontFamily: FONT_REG,
    fontSize: 20,
    color: LIME_GREEN,
    lineHeight: 22,
  },

  // Save / Logout
  saveBtn: {
    marginTop: 28,
    backgroundColor: SAVINGS_BG,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.3,
    borderColor: DARK_GREEN,
  },
  saveBtnConfirmed: {
    backgroundColor: MINT,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontFamily: FONT_BOLD,
    fontSize: 15,
    color: DARK_GREEN,
  },
  logoutBtn: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.3,
    borderColor: '#e4e6e6',
  },
  logoutText: {
    fontFamily: FONT_SEMI,
    fontSize: 14,
    color: '#9b3a2a',
  },
});
