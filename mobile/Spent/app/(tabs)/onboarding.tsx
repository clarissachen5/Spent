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
  Dimensions,
  Image,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

const DARK_GREEN  = '#0a542f';
const LIME_BTN    = '#b8e040';
const BLACK       = '#1e1d19';
const GRAY_TEXT   = '#b0b0b0';
const LIGHT_GRAY  = '#e8e8e8';

const PIG = require('../../assets/images/pig.png');

const CATEGORIES = [
  { key: 'Eating Out',     icon: require('../../assets/icons/foodIcon.svg') },
  { key: 'Groceries',      icon: require('../../assets/icons/bagIcon.svg') },
  { key: 'Coffee',         icon: require('../../assets/icons/coffeeIcon.svg') },
  { key: 'Transportation', icon: require('../../assets/icons/transportationIcon.svg') },
  { key: 'Entertainment',  icon: require('../../assets/icons/entertainmentIcon.svg') },
  { key: 'Shopping',       icon: require('../../assets/icons/shoppingIcon.svg') },
];

function onlyNumbers(v: string) {
  return v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
}

// ── Speech bubble ──────────────────────────────────────────────────────────────
function SpeechBubble({ text, pointer }: { text: string; pointer: 'down' | 'left' }) {
  return (
    <View>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{text}</Text>
      </View>
      {pointer === 'down' && <View style={styles.pointerDown} />}
      {pointer === 'left'  && <View style={styles.pointerLeft} />}
    </View>
  );
}

// ── Continue button pinned to bottom ──────────────────────────────────────────
function BottomButton({
  label = 'Continue',
  onPress,
  disabled,
  loading,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.btnWrapper, { paddingBottom: bottom + 12 }]}>
      <TouchableOpacity
        style={[styles.btn, disabled && styles.btnDisabled]}
        disabled={disabled || loading}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={DARK_GREEN} />
          : <Text style={styles.btnText}>{label}</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { top }  = useSafeAreaInsets();
  const router   = useRouter();
  const { saveUserProfile, saveMonthlyBudget } = useAuth();

  const [step,           setStep]          = useState(0);
  const [timerDone,      setTimerDone]     = useState(false);
  const [pigName,        setPigName]       = useState('');
  const [userName,       setUserName]      = useState('');
  const [userAge,        setUserAge]       = useState('');
  const [annualIncome,   setAnnualIncome]  = useState('');
  const [budgets,        setBudgets]       = useState<Record<string, string>>({});
  const [customCats,     setCustomCats]    = useState<{ key: string; amount: string }[]>([]);
  const [showCatInput,   setShowCatInput]  = useState(false);
  const [customCatName,  setCustomCatName] = useState('');
  const [saving,         setSaving]        = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimerDone(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!timerDone || step !== 0) return;
    setStep(1);
  }, [timerDone]);

  const step2Valid = userName.trim() !== '' && userAge.trim() !== '' && annualIncome.trim() !== '';
  const step3Valid = CATEGORIES.every(c => (budgets[c.key] ?? '').trim() !== '');

  const handleFinish = async () => {
    setSaving(true);
    try {
      const allCatKeys = [
        ...CATEGORIES.map(c => c.key),
        ...customCats.map(c => c.key),
      ];
      await saveUserProfile({
        city: '', school: '',
        categories: allCatKeys,
        goals: [],
        pigName, userName, userAge, annualIncome,
      });
      const budget: Record<string, number> = {};
      CATEGORIES.forEach(c => {
        budget[c.key] = parseFloat(budgets[c.key] || '0') || 0;
      });
      customCats.forEach(c => {
        budget[c.key] = parseFloat(c.amount || '0') || 0;
      });
      await saveMonthlyBudget(budget);
      router.replace({ pathname: '/(tabs)/home', params: { checkIn: Date.now().toString() } });
    } finally {
      setSaving(false);
    }
  };

  const addCustomCat = () => {
    const name = customCatName.trim();
    if (!name) return;
    const allKeys = [...CATEGORIES.map(c => c.key), ...customCats.map(c => c.key)];
    if (allKeys.map(k => k.toLowerCase()).includes(name.toLowerCase())) return;
    setCustomCats(prev => [...prev, { key: name, amount: '' }]);
    setCustomCatName('');
    setShowCatInput(false);
  };

  // ── Step 0: Welcome ───────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={styles.welcome}>
        {/* SVG gradient background */}
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Defs>
            <SvgGradient id="wg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0"    stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="0.45" stopColor="#edf9c0" stopOpacity="1" />
              <Stop offset="1"    stopColor="#c4e438" stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={height} fill="url(#wg)" />
        </Svg>

        <View style={[styles.welcomeCenter, { paddingTop: top }]}>
          <Image source={PIG} style={styles.welcomePig} resizeMode="contain" />
          <Text style={styles.welcomeTitle}>Welcome to Spent</Text>
        </View>
      </View>
    );
  }

  // ── Step 1: Name your pig ─────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.stepContent, { paddingTop: top + 40 }]}>
          <View style={styles.bubbleCenterRow}>
            <SpeechBubble text="Name Me!" pointer="down" />
          </View>
          <Image source={PIG} style={styles.pigCenter} resizeMode="contain" />
          <Text style={styles.fieldLabel}>Your Pig's Name</Text>
          <TextInput
            style={styles.input}
            value={pigName}
            onChangeText={setPigName}
            placeholderTextColor={GRAY_TEXT}
            autoCorrect={false}
          />
        </View>
        <BottomButton onPress={() => setStep(2)} disabled={!pigName.trim()} />
      </KeyboardAvoidingView>
    );
  }

  // ── Step 2: About you ─────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.stepContent, { paddingTop: top + 24, paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mascotRow}>
            <Image source={PIG} style={styles.pigSide2} resizeMode="contain" />
            <View style={styles.bubbleSideWrapper}>
              <SpeechBubble text={"Let's Learn More\nAbout You!"} pointer="left" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={userName}
            onChangeText={setUserName}
            placeholder="i.e. Jane Smith"
            placeholderTextColor={GRAY_TEXT}
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Your age</Text>
          <TextInput
            style={styles.input}
            value={userAge}
            onChangeText={v => setUserAge(onlyNumbers(v))}
            placeholder="i.e. 18"
            placeholderTextColor={GRAY_TEXT}
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Your Annual Income</Text>
          <TextInput
            style={styles.input}
            value={annualIncome}
            onChangeText={v => setAnnualIncome(onlyNumbers(v))}
            placeholder="i.e. 120000"
            placeholderTextColor={GRAY_TEXT}
            keyboardType="number-pad"
          />
        </ScrollView>
        <BottomButton onPress={() => setStep(3)} disabled={!step2Valid} />
      </KeyboardAvoidingView>
    );
  }

  // ── Step 3: Category budgets ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.stepContent, { paddingTop: top + 24, paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotRow}>
          <Image source={PIG} style={styles.pigSide3} resizeMode="contain" />
          <View style={styles.bubbleSideWrapper}>
            <SpeechBubble
              text={"How much do you\nexpect to spend in\neach category\nevery month?"}
              pointer="left"
            />
          </View>
        </View>

        <View style={styles.categoriesBox}>
          <Text style={styles.categoriesTitle}>Categories</Text>
        </View>

        <View style={styles.grid}>
          {CATEGORIES.map(cat => (
            <View key={cat.key} style={styles.categoryCard}>
              <View style={styles.categoryCardHeader}>
                <ExpoImage source={cat.icon} style={styles.categoryIconImg} contentFit="contain" />
                <Text style={styles.categoryLabel}>{cat.key}</Text>
              </View>
              <TextInput
                style={styles.categoryInput}
                value={budgets[cat.key] || ''}
                onChangeText={v =>
                  setBudgets(prev => ({ ...prev, [cat.key]: onlyNumbers(v) }))
                }
                placeholder="i.e. $25"
                placeholderTextColor={GRAY_TEXT}
                keyboardType="decimal-pad"
              />
            </View>
          ))}

          {customCats.map((cat, i) => (
            <View key={cat.key} style={styles.categoryCard}>
              <View style={styles.categoryCardHeader}>
                <ExpoImage
                  source={require('../../assets/icons/otherIcon.svg')}
                  style={styles.categoryIconImg}
                  contentFit="contain"
                />
                <Text style={styles.categoryLabel} numberOfLines={1}>{cat.key}</Text>
              </View>
              <TextInput
                style={styles.categoryInput}
                value={cat.amount}
                onChangeText={v =>
                  setCustomCats(prev =>
                    prev.map((c, j) => j === i ? { ...c, amount: onlyNumbers(v) } : c)
                  )
                }
                placeholder="i.e. $25"
                placeholderTextColor={GRAY_TEXT}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>

        {showCatInput ? (
          <View style={styles.customCatRow}>
            <TextInput
              style={styles.customCatInput}
              placeholder="Category name..."
              placeholderTextColor={GRAY_TEXT}
              value={customCatName}
              onChangeText={setCustomCatName}
              onSubmitEditing={addCustomCat}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity style={styles.customCatAddBtn} onPress={addCustomCat} activeOpacity={0.7}>
              <Text style={styles.customCatAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addCatBtn}
            onPress={() => setShowCatInput(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addCatBtnText}>+ Add category (optional)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <BottomButton onPress={handleFinish} disabled={!step3Valid} loading={saving} />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // Welcome
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCenter: {
    alignItems: 'center',
  },
  welcomePig: {
    width: 260,
    height: 240,
  },
  welcomeTitle: {
    marginTop: 22,
    fontSize: 26,
    fontWeight: '700',
    color: '#3b1c00',
  },

  // Shared step wrapper
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },

  // Mascot layouts
  bubbleCenterRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  pigCenter: {
    width: 200,
    height: 210,
    alignSelf: 'center',
    marginBottom: 28,
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  pigSide2: {
    width: 200,
    height: 215,
  },
  pigSide3: {
    width: 175,
    height: 190,
  },
  bubbleSideWrapper: {
    flex: 1,
    paddingLeft: 10,
  },

  // Speech bubble
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#d8d8d8',
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '500',
    color: BLACK,
    lineHeight: 20,
    textAlign: 'center',
  },
  pointerDown: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#d8d8d8',
  },
  pointerLeft: {
    position: 'absolute',
    top: 16,
    left: -11,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#d8d8d8',
  },

  // Form fields
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.2,
    borderColor: LIGHT_GRAY,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: BLACK,
    marginBottom: 16,
  },

  // Categories
  categoriesBox: {
    borderWidth: 1.5,
    borderColor: '#6aa8f0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    alignSelf: 'stretch',
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: (width - 50) / 2,
    borderWidth: 1.2,
    borderColor: LIGHT_GRAY,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#fff',
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  categoryIconImg: {
    width: 22,
    height: 22,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: BLACK,
  },
  categoryInput: {
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: BLACK,
  },

  addCatBtn: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    borderStyle: 'dashed',
  },
  addCatBtnText: {
    fontSize: 13,
    color: GRAY_TEXT,
    fontWeight: '500',
  },
  customCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  customCatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: BLACK,
  },
  customCatAddBtn: {
    backgroundColor: '#cdf545',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  customCatAddBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a542f',
  },

  // Bottom button
  btnWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: LIME_BTN,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: DARK_GREEN,
  },
});
