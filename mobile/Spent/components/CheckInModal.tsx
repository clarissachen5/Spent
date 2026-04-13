import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image as RNImage,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useAuth, DetectedLocation } from '../context/AuthContext';
import { GOOGLE_MAPS_KEY } from '../constants/config';

// ── Local icons ───────────────────────────────────────────────────────────────
const coffeeIcon          = require('../assets/icons/coffeeIcon.svg');
const shoppingIcon        = require('../assets/icons/shoppingIcon.svg');
const foodIcon            = require('../assets/icons/foodIcon.svg');
const clipboardIcon       = require('../assets/icons/clipboardIcon.svg');
const flameIcon           = require('../assets/icons/flameIcon.svg');
const moneySmallIcon      = require('../assets/icons/moneySmall.svg');
const transportationIcon  = require('../assets/icons/transportationIcon.svg');
const entertainmentIcon   = require('../assets/icons/entertainmentIcon.svg');
const bagIcon             = require('../assets/icons/bagIcon.svg');

// ── Figma item icons ──────────────────────────────────────────────────────────
const smallCoffeeIcon  = require('../assets/icons/smallCoffee.svg');
const mediumCoffeeIcon = require('../assets/icons/mediumCoffee.svg');
const largeCoffeeIcon  = require('../assets/icons/largeCoffee.svg');
const denyIcon         = require('../assets/icons/denyIcon.svg');

// ── Dimensions ────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH    = SCREEN_WIDTH * 0.88;
const CARD_HEIGHT   = SCREEN_HEIGHT * 0.52;
const CARD_RADIUS   = 20;
const HEADER_H      = 62;
const CONTENT_W     = CARD_WIDTH - 40;   // card has 20px side padding
const ITEM_GAP      = CONTENT_W * 0.32;  // spacing between scrubber items
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN  = '#0a542f';
const LIME_GREEN  = '#cdf545';
const OVERLAY_BG  = 'rgba(131,135,117,0.92)';
const PINK_BG     = '#FFF0F8';
const DARK_RED    = '#4F090B';
const GRAY_TEXT   = '#A5A5A5';
const LIGHT_GRAY  = '#DEDFDF';
const PRICE_COLOR = '#800039';
const PINK_BAR    = '#FFB5DB';
const TICK_COLOR  = '#E5DCDE';

// ── Data ──────────────────────────────────────────────────────────────────────
interface LocationItem {
  icon: any;
  label: string;
  price: number;
}
interface Location {
  id:             string | number;
  name:           string;
  category:       string;
  address:        string;
  neighborhood:   string;
  icon:           any;
  accentColor:    string;
  items:          LocationItem[];
  detectedLocId?: string; // set when this card was created from a real tracked visit
}

const LOCATIONS: Location[] = [
  {
    id: 1, name: 'Starbucks', category: 'Coffee',
    address: '100 Newbury St, Boston, MA', neighborhood: 'Coolidge Corner, MA',
    icon: coffeeIcon, accentColor: PINK_BG,
    items: [
      { icon: smallCoffeeIcon,  label: 'small coffee',  price: 3  },
      { icon: mediumCoffeeIcon, label: 'medium coffee', price: 6  },
      { icon: largeCoffeeIcon,  label: 'coffee + pastry', price: 11 },
    ],
  },
  {
    id: 2, name: 'Brookline Booksmith', category: 'Shopping',
    address: '279 Harvard St, Brookline, MA', neighborhood: 'Coolidge Corner, MA',
    icon: shoppingIcon, accentColor: '#F0FBF5',
    items: [
      { icon: shoppingIcon, label: 'bookmark',  price: 3  },
      { icon: shoppingIcon, label: 'paperback', price: 15 },
      { icon: shoppingIcon, label: 'hardcover', price: 28 },
    ],
  },
  {
    id: 3, name: 'Barcelona Wine Bar', category: 'Food',
    address: '1700 Washington St, Boston, MA', neighborhood: 'South End, MA',
    icon: foodIcon, accentColor: '#F5F0FF',
    items: [
      { icon: foodIcon, label: 'wine glass', price: 12 },
      { icon: foodIcon, label: 'appetizer',  price: 16 },
      { icon: foodIcon, label: 'entrée',     price: 28 },
    ],
  },
  {
    id: 4, name: 'CVS Pharmacy', category: 'Shopping',
    address: '36 JFK St, Cambridge, MA', neighborhood: 'Harvard Square, MA',
    icon: shoppingIcon, accentColor: '#FFFBF0',
    items: [
      { icon: shoppingIcon, label: 'snacks',     price: 5  },
      { icon: shoppingIcon, label: 'toiletries', price: 12 },
      { icon: shoppingIcon, label: 'medicine',   price: 25 },
    ],
  },
];

// ── Missed-expense categories ─────────────────────────────────────────────────
interface MissedCategory {
  name:      string;
  icon:      any;
  bg:        string;
  textColor: string;
  category:  string; // maps to CheckInResult.category
}

const MISSED_CATEGORIES: MissedCategory[] = [
  { name: 'Food Delivery',    icon: foodIcon,           bg: '#eefbfd', textColor: '#0a2627', category: 'Food'           },
  { name: 'Online Shopping',  icon: bagIcon,            bg: '#fff6d6', textColor: '#4f090b', category: 'Shopping'       },
  { name: 'Airfares',         icon: transportationIcon, bg: '#ffeddd', textColor: '#4f090b', category: 'Transportation' },
  { name: 'Concert Tickets',  icon: entertainmentIcon,  bg: '#f8eeff', textColor: '#400981', category: 'Entertainment'  },
  { name: 'Shopping Centers', icon: shoppingIcon,       bg: '#fff6d6', textColor: '#4f090b', category: 'Shopping'       },
  { name: 'Food Trucks',      icon: foodIcon,           bg: '#eefbfd', textColor: '#0a2627', category: 'Food'           },
  { name: 'Subscriptions',    icon: entertainmentIcon,  bg: '#f8eeff', textColor: '#400981', category: 'Entertainment'  },
];

// ── MissedExpensesCard ────────────────────────────────────────────────────────
interface MissedExpensesCardProps {
  onDone: () => void;
  onLog:  (name: string, category: string, amount: number) => void;
}

function MissedExpensesCard({ onDone, onLog }: MissedExpensesCardProps) {
  type Mode = 'grid' | 'tile' | 'manual';
  const [mode,        setMode]        = useState<Mode>('grid');
  const [selected,    setSelected]    = useState<MissedCategory | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [manualName,  setManualName]  = useState('');
  const [logged,      setLogged]      = useState<string | null>(null);

  const resetToGrid = () => {
    setMode('grid');
    setSelected(null);
    setAmountInput('');
    setManualName('');
  };

  const handleTileTap = (cat: MissedCategory) => {
    setSelected(cat);
    setAmountInput('');
    setMode('tile');
  };

  const handleLog = () => {
    const amt = parseFloat(amountInput);
    if (!amt || amt <= 0) return;
    const name     = mode === 'manual' ? manualName.trim() || 'Manual Entry' : selected!.name;
    const category = mode === 'manual' ? 'Other'                              : selected!.category;
    onLog(name, category, amt);
    setLogged(name);
    setTimeout(() => { setLogged(null); resetToGrid(); }, 1000);
  };

  // ── Grid view ──
  if (mode === 'grid') {
    const rows: MissedCategory[][] = [];
    for (let i = 0; i < MISSED_CATEGORIES.length; i += 2) {
      rows.push(MISSED_CATEGORIES.slice(i, i + 2));
    }
    return (
      <View style={missedStyles.card}>
        <Text style={missedStyles.heading}>DID SPENT MISS ANYTHING?</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          {rows.map((row, ri) => (
            <View key={ri} style={missedStyles.tileRow}>
              {row.map(cat => (
                <TouchableOpacity
                  key={cat.name}
                  style={[missedStyles.tile, { backgroundColor: cat.bg }]}
                  onPress={() => handleTileTap(cat)}
                  activeOpacity={0.75}
                >
                  <Image source={cat.icon} style={missedStyles.tileIcon} contentFit="contain" />
                  <Text style={[missedStyles.tileName, { color: cat.textColor }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Manual Input */}
          <TouchableOpacity
            style={missedStyles.manualBtn}
            onPress={() => { setMode('manual'); setAmountInput(''); setManualName(''); }}
            activeOpacity={0.8}
          >
            <View style={missedStyles.manualPlusCircle}>
              <Text style={missedStyles.manualPlus}>+</Text>
            </View>
            <Text style={missedStyles.manualLabel}>Manual Input</Text>
          </TouchableOpacity>

          <TouchableOpacity style={missedStyles.doneBtn} onPress={onDone} activeOpacity={0.8}>
            <Text style={missedStyles.doneBtnTxt}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Tile / Manual input view ──
  const tileColor = selected?.textColor ?? DARK_RED;
  const tileBg    = selected?.bg        ?? '#ffe6e2';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
      <View style={missedStyles.card}>
        <TouchableOpacity onPress={resetToGrid} style={missedStyles.backRow} hitSlop={12}>
          <Text style={missedStyles.backTxt}>← Back</Text>
        </TouchableOpacity>

        {/* Category display */}
        {mode === 'tile' && selected ? (
          <View style={[missedStyles.selectedTile, { backgroundColor: tileBg }]}>
            <Image source={selected.icon} style={missedStyles.selectedIcon} contentFit="contain" />
            <Text style={[missedStyles.selectedName, { color: tileColor }]}>{selected.name}</Text>
          </View>
        ) : (
          <TextInput
            style={missedStyles.nameInput}
            placeholder="Expense name"
            placeholderTextColor={GRAY_TEXT}
            value={manualName}
            onChangeText={setManualName}
            autoFocus
          />
        )}

        <Text style={missedStyles.amountLabel}>How much did you spend?</Text>
        <View style={missedStyles.amountRow}>
          <Text style={missedStyles.dollarSign}>$</Text>
          <TextInput
            style={missedStyles.amountInput}
            placeholder="0.00"
            placeholderTextColor={GRAY_TEXT}
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="decimal-pad"
            autoFocus={mode === 'tile'}
          />
        </View>

        {logged ? (
          <View style={missedStyles.loggedPill}>
            <Text style={missedStyles.loggedTxt}>✓ Logged {logged}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[missedStyles.logBtn, (!amountInput || parseFloat(amountInput) <= 0) && missedStyles.logBtnDisabled]}
            onPress={handleLog}
            disabled={!amountInput || parseFloat(amountInput) <= 0}
            activeOpacity={0.8}
          >
            <Text style={missedStyles.logBtnTxt}>Log It</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Generic price items per category (used for detected locations) ────────────
// ── Budget Estimate Card ──────────────────────────────────────────────────────
const BUDGET_CATEGORIES = [
  { name: 'Food',           icon: foodIcon,           color: '#C8E8FF', max: 600 },
  { name: 'Coffee',         icon: coffeeIcon,         color: '#F4B8C8', max: 200 },
  { name: 'Shopping',       icon: bagIcon,            color: '#fcb842', max: 600 },
  { name: 'Entertainment',  icon: entertainmentIcon,  color: '#C9A8E8', max: 400 },
  { name: 'Transportation', icon: transportationIcon, color: '#FFCBA4', max: 400 },
  { name: 'Other',          icon: shoppingIcon,       color: '#F4A0A0', max: 400 },
];


function BudgetEstimateCard({ onSave }: { onSave: () => void }) {
  const { saveMonthlyBudget, monthlyBudget } = useAuth();
  const [amounts, setAmounts] = useState<Record<string, number>>(
    Object.fromEntries(BUDGET_CATEGORIES.map(c => [c.name, monthlyBudget[c.name] ?? 0])),
  );

  const total = Object.values(amounts).reduce((s, v) => s + v, 0);

  const handleSave = async () => {
    await saveMonthlyBudget(amounts);
    onSave();
  };

  return (
    <View style={budgetStyles.card}>
      <Text style={budgetStyles.title}>How much do you think{'\n'}you will spend this month?</Text>
      <Text style={budgetStyles.totalLabel}>
        Total estimate: <Text style={budgetStyles.totalAmt}>${total}</Text>
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
        contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
      >
        {BUDGET_CATEGORIES.map(cat => (
          <View key={cat.name} style={budgetStyles.categoryRow}>
            <View style={budgetStyles.categoryHeader}>
              <View style={[budgetStyles.iconWrap, { backgroundColor: cat.color }]}>
                <Image source={cat.icon} style={budgetStyles.catIcon} contentFit="contain" />
              </View>
              <Text style={budgetStyles.categoryName}>{cat.name}</Text>
              <Text style={budgetStyles.categoryAmt}>${amounts[cat.name]}</Text>
            </View>
            <Slider
              style={budgetStyles.slider}
              value={amounts[cat.name]}
              onValueChange={v =>
                setAmounts(prev => ({ ...prev, [cat.name]: Math.round(v / 5) * 5 }))
              }
              minimumValue={0}
              maximumValue={cat.max}
              step={5}
              minimumTrackTintColor={DARK_GREEN}
              maximumTrackTintColor="#E5E5E5"
              thumbTintColor={DARK_GREEN}
            />
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={budgetStyles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
        <Text style={budgetStyles.saveBtnTxt}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const budgetStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    alignItems: 'stretch',
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: DARK_GREEN,
    lineHeight: 23,
  },
  totalLabel: {
    fontSize: 12,
    color: GRAY_TEXT,
    fontWeight: '500',
  },
  totalAmt: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_GREEN,
  },
  categoryRow: {
    gap: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIcon: {
    width: 15,
    height: 15,
  },
  categoryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e1d19',
  },
  categoryAmt: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_GREEN,
    minWidth: 40,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 32,
    marginTop: -4,
  },
  saveBtn: {
    backgroundColor: DARK_GREEN,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnTxt: {
    color: LIME_GREEN,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Generic price items per category (used for detected locations) ────────────
const CATEGORY_ITEMS: Record<string, LocationItem[]> = {
  Coffee:         [{ icon: smallCoffeeIcon, label: 'small coffee', price: 3 }, { icon: mediumCoffeeIcon, label: 'medium coffee', price: 6 }, { icon: largeCoffeeIcon, label: 'coffee + pastry', price: 11 }],
  Food:           [{ icon: foodIcon, label: 'snack', price: 8 }, { icon: foodIcon, label: 'meal', price: 16 }, { icon: foodIcon, label: 'large meal', price: 28 }],
  Shopping:       [{ icon: shoppingIcon, label: 'small purchase', price: 10 }, { icon: shoppingIcon, label: 'purchase', price: 25 }, { icon: shoppingIcon, label: 'big purchase', price: 50 }],
  Entertainment:  [{ icon: foodIcon, label: 'ticket', price: 15 }, { icon: foodIcon, label: 'event', price: 30 }, { icon: foodIcon, label: 'experience', price: 60 }],
  Transportation: [{ icon: shoppingIcon, label: 'ride', price: 5 }, { icon: shoppingIcon, label: 'trip', price: 15 }, { icon: shoppingIcon, label: 'day pass', price: 30 }],
  Other:          [{ icon: shoppingIcon, label: 'small', price: 5 }, { icon: shoppingIcon, label: 'medium', price: 15 }, { icon: shoppingIcon, label: 'large', price: 30 }],
};
const CATEGORY_ICON: Record<string, any> = {
  Coffee: coffeeIcon, Food: foodIcon, Shopping: shoppingIcon,
  Entertainment: foodIcon, Transportation: shoppingIcon, Other: shoppingIcon,
};
const CATEGORY_COLOR: Record<string, string> = {
  Coffee: PINK_BG, Food: '#F5F0FF', Shopping: '#F0FBF5',
  Entertainment: '#F0F5FF', Transportation: '#FFFBF0', Other: '#FFFBF0',
};

function detectedToLocation(d: DetectedLocation): Location {
  const cat = d.category;
  return {
    id:            d.id,
    name:          d.place_name,
    category:      cat,
    address:       d.address,
    neighborhood:  d.address,
    icon:          CATEGORY_ICON[cat] ?? shoppingIcon,
    accentColor:   CATEGORY_COLOR[cat] ?? PINK_BG,
    items:         CATEGORY_ITEMS[cat] ?? CATEGORY_ITEMS.Other,
    detectedLocId: d.id,
  };
}

function formatCheckInTime(): string {
  const d    = new Date();
  const h    = d.getHours() % 12 || 12;
  const m    = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return `${h}:${m}${ampm}`;
}

function staticMapUrl(address: string): string {
  const addr   = encodeURIComponent(address);
  const marker = encodeURIComponent(`color:0x4F090B|${address}`);
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${addr}&zoom=16&size=600x400&scale=2&maptype=roadmap` +
    `&markers=${marker}&key=${GOOGLE_MAPS_KEY}`
  );
}

// ── Scrubber ruler ────────────────────────────────────────────────────────────
const RULER_PAD   = CONTENT_W / 2;
const TICK_UNIT   = 14;
const TICK_SHORT  = 9;
const TICK_TALL   = 20;
const RULER_BELOW = 16;   // px below baseline for labels
const RULER_CLIP_H = TICK_TALL + 30 + RULER_BELOW; // icons(30) + ticks(20) + labels(16) = 66

interface ScrubItem extends LocationItem {
  isNothing: boolean;
}

function buildScrubItems(location: Location): ScrubItem[] {
  return [
    { icon: denyIcon, label: 'nothing', price: 0, isNothing: true },
    ...location.items.map(i => ({ ...i, isNothing: false })),
  ];
}

function buildTicks(numItems: number): { x: number; height: number }[] {
  const rulerW = RULER_PAD + (numItems - 1) * ITEM_GAP + RULER_PAD;
  const result: { x: number; height: number }[] = [];
  for (let x = 0; x <= rulerW; x += TICK_UNIT) {
    const nearItem = Array.from({ length: numItems }).some(
      (_, i) => Math.abs(RULER_PAD + i * ITEM_GAP - x) < TICK_UNIT / 2,
    );
    result.push({ x, height: nearItem ? TICK_TALL : TICK_SHORT });
  }
  return result;
}

function computeValueFromOffset(
  off: number,
  prices: number[],
): { price: number; isNothing: boolean } {
  'worklet';
  const n   = prices.length;
  const pos = Math.max(0, Math.min(n - 1, -off / ITEM_GAP));
  if (pos < 0.01) return { price: 0, isNothing: true };
  const lowerIdx = Math.floor(pos);
  const upperIdx = Math.min(lowerIdx + 1, n - 1);
  const t        = pos - lowerIdx;
  const price    = prices[lowerIdx] + (prices[upperIdx] - prices[lowerIdx]) * t;
  return { price: Math.round(price), isNothing: false };
}

// ── ActiveCard ────────────────────────────────────────────────────────────────
interface ActiveCardProps {
  location: Location;
  onSwipe:  (dir: 'left' | 'right', amount?: number) => void;
}

function ActiveCard({ location, onSwipe }: ActiveCardProps) {
  const [isFlipped,         setIsFlipped]         = useState(false);
  const [selectedPrice,     setSelectedPrice]     = useState(location.items[0].price);
  const [selectedIsNothing, setSelectedIsNothing] = useState(false);
  const checkInTime = useRef(formatCheckInTime()).current;
  const { checkInResults } = useAuth();

  const translateX   = useSharedValue(0);
  const translateY   = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const scrubStart   = useSharedValue(0);
  // start centered on item[1] (first real item)
  const scrubOffset  = useSharedValue(-ITEM_GAP);

  const scrubItems = useMemo(() => buildScrubItems(location), [location]);
  const prices     = useMemo(() => scrubItems.map(i => i.price), [scrubItems]);
  const ticks      = useMemo(() => buildTicks(scrubItems.length), [scrubItems.length]);
  const rulerW     = RULER_PAD + (scrubItems.length - 1) * ITEM_GAP + RULER_PAD;

  // ── Stats from history ──
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = checkInResults.filter(r => {
      const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      return r.location === location.name && r.visited
        && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const allVisits = checkInResults.filter(
      r => r.location === location.name && r.visited && r.amount,
    );
    const avg = allVisits.length
      ? allVisits.reduce((s, r) => s + (r.amount || 0), 0) / allVisits.length
      : 0;
    return {
      visits: thisMonth.length,
      total:  thisMonth.reduce((s, r) => s + (r.amount || 0), 0),
      avg:    Math.round(avg * 100) / 100,
    };
  }, [checkInResults, location.name]);

  // ── Fly helpers ──
  const flyRight = (amount: number) => {
    translateX.value = withSpring(
      SCREEN_WIDTH * 1.6, { velocity: 800 },
      () => runOnJS(onSwipe)('right', amount),
    );
  };
  const flyLeft = () => {
    translateX.value = withSpring(
      -SCREEN_WIDTH * 1.6, { velocity: 800 },
      () => runOnJS(onSwipe)('left'),
    );
  };

  // ── Gestures ──
  const mainGesture = Gesture.Pan()
    .enabled(!isFlipped)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.1;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        flipProgress.value = withSpring(1, { damping: 14, stiffness: 120 });
        runOnJS(setIsFlipped)(true);
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          -SCREEN_WIDTH * 1.6, { velocity: e.velocityX },
          () => runOnJS(onSwipe)('left'),
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const flipBackTap = Gesture.Tap()
    .enabled(isFlipped)
    .onEnd(() => {
      flipProgress.value = withSpring(0, { damping: 14, stiffness: 120 });
      runOnJS(setIsFlipped)(false);
    });

  const backSwipeGesture = Gesture.Pan()
    .enabled(isFlipped)
    .onUpdate(e => {
      if (e.translationX < 0) {
        translateX.value = e.translationX;
        translateY.value = e.translationY * 0.1;
      }
    })
    .onEnd(e => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          -SCREEN_WIDTH * 1.6, { velocity: e.velocityX },
          () => runOnJS(onSwipe)('left'),
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const scrubGesture = Gesture.Pan()
    .enabled(isFlipped)
    .onBegin(() => { scrubStart.value = scrubOffset.value; })
    .onUpdate(e => {
      const maxOff  = 0;
      const minOff  = -(scrubItems.length - 1) * ITEM_GAP;
      const raw     = scrubStart.value + e.translationX;
      // snap to nearest tick mark
      const snapped = Math.round(raw / TICK_UNIT) * TICK_UNIT;
      const next    = Math.max(minOff, Math.min(maxOff, snapped));
      scrubOffset.value = next;
      const val = computeValueFromOffset(next, prices);
      runOnJS(setSelectedPrice)(val.price);
      runOnJS(setSelectedIsNothing)(val.isNothing);
    })
    .onEnd(() => {
      // already on a tick — just confirm displayed value
      const val = computeValueFromOffset(scrubOffset.value, prices);
      runOnJS(setSelectedPrice)(val.price);
      runOnJS(setSelectedIsNothing)(val.isNothing);
    });

  const outerGesture = Gesture.Race(mainGesture, backSwipeGesture, flipBackTap);

  // ── Animated styles ──
  const wrapperStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-10, 0, 10], Extrapolation.CLAMP,
    );
    return { transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { rotate: `${rotate}deg` }] };
  });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` }],
    opacity: interpolate(flipProgress.value, [0.38, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` }],
    opacity: interpolate(flipProgress.value, [0.5, 0.62], [0, 1], Extrapolation.CLAMP),
  }));

  const visitedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const skippedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const rulerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrubOffset.value }],
  }));


  return (
    <GestureDetector gesture={outerGesture}>
      <Animated.View style={[styles.cardWrapper, wrapperStyle]}>

        {/* ── Front face ── */}
        <Animated.View style={[styles.cardFace, { backgroundColor: location.accentColor }, frontStyle]}>
          <View style={styles.nameRow}>
            <Image source={location.icon} style={styles.nameIcon} contentFit="contain" />
            <Text style={styles.nameTxt}>{location.name}</Text>
          </View>
          <View style={styles.timeBlock}>
            <View style={styles.pinkBar} />
            <View>
              <Text style={styles.timeTxt}>Today @{checkInTime}</Text>
              <Text style={styles.neighborhoodTxt}>{location.neighborhood}</Text>
            </View>
          </View>
          <View style={styles.mapBox}>
            <RNImage
              source={{ uri: staticMapUrl(location.address) }}
              style={styles.mapImage}
              resizeMode="cover"
            />
          </View>
          <Animated.View style={[styles.visitedOverlay, visitedOpacity]}>
            <View style={[styles.stamp, { borderColor: DARK_GREEN }]}>
              <Text style={[styles.stampTxt, { color: DARK_GREEN }]}>VISITED</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.skippedOverlay, skippedOpacity]}>
            <View style={[styles.stamp, { borderColor: '#c0392b' }]}>
              <Text style={[styles.stampTxt, { color: '#c0392b' }]}>SKIPPED</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── Back face ── */}
        <Animated.View style={[styles.cardFace, styles.backFace, backStyle]}>

          {/* Header box */}
          <View style={styles.backHeader}>
            <View style={styles.nameRow}>
              <Image source={location.icon} style={styles.nameIcon} contentFit="contain" />
              <Text style={styles.nameTxt}>{location.name}</Text>
            </View>
            <View style={styles.backTimeRow}>
              <Text style={styles.backTimeTxt}>{checkInTime}</Text>
              <Text style={styles.backNeighborhoodTxt}>{location.neighborhood}</Text>
            </View>
          </View>

          {/* Scrubber */}
          <View style={styles.scrubContainer}>
            {/* Ruler clips overflow so items outside bounds are hidden */}
            <View style={styles.scrubClip}>
              <GestureDetector gesture={scrubGesture}>
                <Animated.View style={[{ width: rulerW, height: RULER_CLIP_H }, rulerAnimStyle]}>
                  {/* Tick marks */}
                  {ticks.map((tick, idx) => (
                    <View
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: tick.x,
                        bottom: RULER_BELOW,
                        width: 1.5,
                        height: tick.height,
                        backgroundColor: TICK_COLOR,
                      }}
                    />
                  ))}
                  {/* Horizontal baseline */}
                  <View style={{ position: 'absolute', bottom: RULER_BELOW, left: 0, width: rulerW, height: 1, backgroundColor: TICK_COLOR }} />
                  {/* Icons above baseline */}
                  {scrubItems.map((item, i) => {
                    const cx = RULER_PAD + i * ITEM_GAP;
                    return (
                      <View key={i} style={{ position: 'absolute', left: cx - 10, bottom: TICK_TALL + RULER_BELOW + 8, alignItems: 'center', width: 20 }}>
                        {item.isNothing ? (
                          <View style={styles.denyCircle}>
                            <Image source={denyIcon} style={styles.denyIcon} contentFit="contain" />
                          </View>
                        ) : (
                          <Image source={item.icon} style={styles.scrubIcon} contentFit="contain" />
                        )}
                      </View>
                    );
                  })}
                  {/* Labels below baseline */}
                  {scrubItems.map((item, i) => {
                    const cx = RULER_PAD + i * ITEM_GAP;
                    return (
                      <View key={`lbl-${i}`} style={{ position: 'absolute', left: cx - 40, bottom: 0, width: 80, alignItems: 'center' }}>
                        <Text style={styles.scrubLabel}>{item.label}</Text>
                      </View>
                    );
                  })}
                </Animated.View>
              </GestureDetector>
            </View>

            {/* Price pill — fixed at center, sitting on the baseline */}
            <View style={styles.pricePillAnchor} pointerEvents="none">
              <View style={styles.pricePill}>
                {!selectedIsNothing && (
                  <Image source={moneySmallIcon} style={styles.pricePillIcon} contentFit="contain" />
                )}
                <Text style={[styles.pricePillTxt, selectedIsNothing && { color: GRAY_TEXT }]}>
                  {selectedIsNothing ? 'skip' : `$${selectedPrice}`}
                </Text>
              </View>
            </View>
          </View>

          {/* Spending pattern */}
          <View style={styles.statsBox}>
            <Text style={styles.statsTitle}>YOUR PATTERN HERE</Text>
            <View style={styles.statsTiles}>
              <View style={styles.statTile}>
                <View style={styles.statValRow}>
                  <Image source={moneySmallIcon} style={styles.statIcon} contentFit="contain" />
                  <Text style={styles.statAmt}>{stats.avg.toFixed(2)}</Text>
                </View>
                <Text style={styles.statLabel}>avg spend</Text>
              </View>
              <View style={styles.statTile}>
                <View style={styles.statValRow}>
                  <Text style={styles.statCount}>×{stats.visits}</Text>
                </View>
                <Text style={styles.statLabel}>this month</Text>
              </View>
              <View style={styles.statTile}>
                <View style={styles.statValRow}>
                  <Image source={moneySmallIcon} style={styles.statIcon} contentFit="contain" />
                  <Text style={styles.statAmt}>{stats.total}</Text>
                </View>
                <Text style={styles.statLabel}>this month</Text>
              </View>
            </View>
          </View>

          {/* LOG button */}
          <TouchableOpacity style={styles.logBtn} onPress={() => {
            if (selectedIsNothing) flyLeft(); else flyRight(selectedPrice);
          }} activeOpacity={0.75}>
            <Text style={styles.logBtnTxt}>{selectedIsNothing ? 'SKIP' : 'LOG'}</Text>
          </TouchableOpacity>

        </Animated.View>

      </Animated.View>
    </GestureDetector>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CheckInModal({ visible, onClose }: CheckInModalProps) {
  const { addCheckInResult, pendingLocations, markLocationShown } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMissed,   setShowMissed]   = useState(false);
  const [showBudget,   setShowBudget]   = useState(false);

  // Use real tracked locations when available, otherwise fall back to hardcoded demo data
  const locations: Location[] = pendingLocations.length > 0
    ? pendingLocations.map(detectedToLocation)
    : LOCATIONS;

  // Reset to first card whenever the location list changes
  const locKey = locations.map(l => l.id).join(',');
  React.useEffect(() => { setCurrentIndex(0); }, [locKey]);

  const handleSwipe = (dir: 'left' | 'right', amount?: number) => {
    const location = locations[currentIndex];
    addCheckInResult({
      location:  location.name,
      category:  location.category,
      visited:   dir === 'right',
      amount:    dir === 'right' ? (amount ?? 0) : undefined,
      timestamp: new Date(),
    });
    if (location.detectedLocId) {
      markLocationShown(location.detectedLocId);
    }
    const next = currentIndex + 1;
    if (next >= locations.length) {
      setTimeout(() => { setCurrentIndex(0); setShowMissed(true); }, 350);
    } else {
      setCurrentIndex(next);
    }
  };

  const handleClose = () => {
    setShowMissed(false);
    setShowBudget(false);
    setCurrentIndex(0);
    onClose();
  };

  const remaining = locations.slice(currentIndex);
  const active    = remaining[0];
  const collapsed = remaining.slice(1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>

        <View style={styles.header}>
          <Image source={clipboardIcon} style={styles.headerIcon} contentFit="contain" />
          <Text style={styles.headerTitle}>Check In</Text>
          <View style={styles.streakPill}>
            <Image source={flameIcon} style={styles.flameIcon} contentFit="contain" />
            <Text style={styles.streakTxt}>3</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          {showBudget ? 'Set your monthly budget' : 'Swipe right if you visited, left if not'}
        </Text>

        {showBudget ? (
          <BudgetEstimateCard onSave={handleClose} />
        ) : showMissed ? (
          <MissedExpensesCard
            onDone={() => setShowBudget(true)}
            onLog={(name, category, amount) =>
              addCheckInResult({ location: name, category, visited: true, amount, timestamp: new Date() })
            }
          />
        ) : remaining.length > 0 ? (
          <View style={[styles.stackContainer, { height: CARD_HEIGHT + collapsed.length * HEADER_H }]}>
            {[...collapsed].reverse().map((loc, i) => {
              const distFromFront = collapsed.length - 1 - i;
              const bgColor  = distFromFront === 2 ? PINK_BG  : distFromFront === 1 ? '#FFFFFF' : '#EBEBEB';
              return (
                <View
                  key={loc.id}
                  style={[styles.backCard, { top: i * HEADER_H, backgroundColor: bgColor, zIndex: 9 - distFromFront }]}
                >
                  <View style={styles.peekRow}>
                    <Image source={loc.icon} style={styles.peekIcon} contentFit="contain" />
                    <Text style={styles.peekName}>{loc.name}</Text>
                  </View>
                </View>
              );
            })}
            <View style={[styles.activeCardSlot, { top: collapsed.length * HEADER_H }]}>
              <ActiveCard key={active.id} location={active} onSwipe={handleSwipe} />
            </View>
          </View>
        ) : (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>All done!</Text>
            <Text style={styles.doneSub}>Check-in saved.</Text>
          </View>
        )}

        <View style={styles.dots}>
          {locations.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentIndex   && styles.dotDone,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: OVERLAY_BG,
    alignItems: 'center', paddingTop: 64, paddingBottom: 40,
  },

  // ── Modal header ──
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: CARD_WIDTH, marginBottom: 6,
  },
  headerIcon:  { width: 18, height: 22 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#fff' },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DARK_GREEN, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  flameIcon: { width: 9, height: 11 },
  streakTxt: { fontSize: 12, color: LIME_GREEN, fontWeight: '600' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 20 },

  // ── Stack ──
  stackContainer: { width: CARD_WIDTH, position: 'relative' },
  backCard: {
    position: 'absolute', width: CARD_WIDTH, height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  activeCardSlot: { position: 'absolute', width: CARD_WIDTH, zIndex: 10 },

  // ── Peek row inside stacked back cards ──
  peekRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, gap: 10,
  },
  peekIcon: { width: 20, height: 20 },
  peekName: { fontSize: 16, fontWeight: '600', color: DARK_RED },

  // ── Card wrapper (holds both faces) ──
  cardWrapper: {
    width: CARD_WIDTH, height: CARD_HEIGHT,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  cardFace: {
    position: 'absolute', width: CARD_WIDTH, height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS, overflow: 'hidden',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },

  // ── Shared name row ──
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameIcon: { width: 20, height: 20 },
  nameTxt:  { fontSize: 16, fontWeight: '600', color: DARK_RED },

  // ── Front face ──
  timeBlock: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 14, marginBottom: 12,
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10,
  },
  pinkBar: { width: 3, borderRadius: 2, backgroundColor: PINK_BAR, alignSelf: 'stretch' },
  timeTxt:         { fontSize: 10, fontWeight: '500', color: DARK_RED },
  neighborhoodTxt: { fontSize: 10, color: GRAY_TEXT, marginTop: 4 },
  mapBox:   { flex: 1, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden' },
  mapImage: { flex: 1, width: '100%', height: undefined },
  visitedOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,84,47,0.10)',
    alignItems: 'flex-start', justifyContent: 'flex-start', padding: 18,
  },
  skippedOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(192,57,43,0.08)',
    alignItems: 'flex-end', justifyContent: 'flex-start', padding: 18,
  },
  stamp: {
    borderWidth: 3, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  stampTxt: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  // ── Back face ──
  backFace: { backgroundColor: '#fff', gap: 12 },

  backHeader: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  backTimeRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  backTimeTxt:         { fontSize: 10, fontWeight: '500', color: GRAY_TEXT },
  backNeighborhoodTxt: { fontSize: 10, color: GRAY_TEXT },

  // ── Scrubber ──
  scrubContainer: {
    position: 'relative',
  },
  scrubClip: {
    height: RULER_CLIP_H,
    overflow: 'hidden',
  },

  scrubIcon:  { width: 20, height: 20 },
  scrubLabel: { fontSize: 9, color: GRAY_TEXT, textAlign: 'center' },

  // Price pill — fixed overlay at center of scrubber, sitting on the baseline
  pricePillAnchor: {
    position: 'absolute',
    left: 0, right: 0,
    top: RULER_CLIP_H - RULER_BELOW - 13, // center pill (≈26px tall) on baseline
    alignItems: 'center',
    zIndex: 10,
  },
  pricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  pricePillIcon: { width: 13, height: 13 },
  pricePillTxt:  { fontSize: 14, fontWeight: '600', color: PRICE_COLOR },

  denyCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FFB5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  denyIcon: { width: 8, height: 8 },

  // ── Stats ──
  statsBox: {
    borderWidth: 1, borderColor: LIGHT_GRAY,
    borderRadius: 10, padding: 10, gap: 8,
  },
  statsTitle: {
    fontSize: 9, color: GRAY_TEXT, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statsTiles: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1, backgroundColor: PINK_BG,
    borderRadius: 10, padding: 8, gap: 4,
    justifyContent: 'flex-end',
  },
  statValRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statIcon:  { width: 13, height: 13 },
  statAmt:   { fontSize: 14, fontWeight: '600', color: PRICE_COLOR },
  statCount: { fontSize: 14, fontWeight: '600', color: DARK_RED },
  statLabel: { fontSize: 9, color: DARK_RED },

  // ── LOG button ──
  logBtn: {
    borderWidth: 1, borderColor: DARK_RED,
    borderRadius: 20, paddingVertical: 6,
    alignItems: 'center',
  },
  logBtnTxt: { fontSize: 16, fontWeight: '600', color: DARK_RED },

  // ── Progress dots ──
  dots:      { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 22, borderRadius: 4 },
  dotDone:   { backgroundColor: LIME_GREEN },

  // ── Done card ──
  doneCard: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: CARD_RADIUS,
    backgroundColor: '#d2f3e2', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  doneTitle: { fontSize: 28, fontWeight: '700', color: DARK_GREEN },
  doneSub:   { fontSize: 14, color: DARK_GREEN, opacity: 0.7 },
});

// ── MissedExpensesCard styles ─────────────────────────────────────────────────
const missedStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#fff',
    padding: 20,
    gap: 10,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  heading: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1e1d19',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tileRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  tileIcon: { width: 20, height: 20 },
  tileName: { fontSize: 10, textAlign: 'center' },

  // Manual input button
  manualBtn: {
    borderWidth: 1,
    borderColor: DARK_RED,
    borderRadius: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 5,
    marginBottom: 10,
  },
  manualPlusCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ffe6e2',
    alignItems: 'center', justifyContent: 'center',
  },
  manualPlus:  { fontSize: 14, color: DARK_RED, lineHeight: 18 },
  manualLabel: { fontSize: 10, color: DARK_RED },

  doneBtn: {
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneBtnTxt: { fontSize: 13, fontWeight: '600', color: '#555' },

  // Input mode
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backTxt: { fontSize: 13, color: DARK_RED, fontWeight: '600' },

  selectedTile: {
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  selectedIcon: { width: 24, height: 24 },
  selectedName: { fontSize: 14, fontWeight: '600' },

  nameInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1e1d19',
  },
  amountLabel: { fontSize: 11, color: GRAY_TEXT, marginTop: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dollarSign: { fontSize: 22, fontWeight: '600', color: DARK_RED },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: DARK_RED,
    borderBottomWidth: 2,
    borderBottomColor: DARK_RED,
    paddingBottom: 4,
  },
  logBtn: {
    marginTop: 12,
    backgroundColor: DARK_RED,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logBtnDisabled: { opacity: 0.4 },
  logBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  loggedPill: {
    marginTop: 12,
    backgroundColor: '#d2f3e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loggedTxt: { fontSize: 14, fontWeight: '600', color: DARK_GREEN },
});
