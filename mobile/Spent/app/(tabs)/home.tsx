import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import CheckInModal from '../../components/CheckInModal';

// ── Figma assets (local SVGs with CSS vars resolved) ─────────────────────────
const chevronLeft        = require('../../assets/icons/chevronLeft.svg');
const chevronRight       = require('../../assets/icons/chevronRight.svg');
const dollarSignLarge    = require('../../assets/icons/dollarSignLarge.svg');
const clipboardIcon      = require('../../assets/icons/clipboardIcon.svg');
const flameIcon          = require('../../assets/icons/flameIcon.svg');
const heroLandscape      = require('../../assets/icons/heroLandscape.svg');
const bagIcon            = require('../../assets/icons/bagIcon.svg');
const seeMoreArrow       = require('../../assets/icons/seeMoreArrow.svg');
const foodIcon           = require('../../assets/icons/foodIcon.svg');
const budgetMarkerLine   = require('../../assets/icons/budgetMarkerLine.svg');
const dollarSignSmall    = require('../../assets/icons/dollarSignSmall.svg');
const shoppingIcon       = require('../../assets/icons/shoppingIcon.svg');
const coffeeIcon         = require('../../assets/icons/coffeeIcon.svg');
const entertainmentIcon  = require('../../assets/icons/entertainmentIcon.svg');
const transportationIcon = require('../../assets/icons/transportationIcon.svg');
const otherIcon          = require('../../assets/icons/otherIcon.svg');
const calendarIcon       = require('../../assets/icons/calendarIcon.svg');
// ─────────────────────────────────────────────────────────────────────────────

// Indexed by Date.getDay() (0 = Sun)
const DAY_NAMES = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];

const CATEGORY_META = [
  { name: 'Food',           icon: foodIcon,           budget: 200 },
  { name: 'Shopping',       icon: shoppingIcon,       budget: 150 },
  { name: 'Coffee',         icon: coffeeIcon,         budget: 100 },
  { name: 'Entertainment',  icon: entertainmentIcon,  budget: 150 },
  { name: 'Transportation', icon: transportationIcon, budget: 100 },
  { name: 'Other',          icon: otherIcon,          budget: 100 },
];

// Returns 7 consecutive dates starting at today + dayOffset
function getVisibleDates(dayOffset: number = 0): Date[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + dayOffset + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Green heatmap: no events = mint, more events = darker green
function getHeatmapColor(count: number): string {
  if (!count) return '#d2f3e2';
  const t = Math.min(count, 5) / 5;
  // interpolate from mint #d2f3e2 → dark green #0a542f
  const r = Math.round(210 - t * (210 - 10));
  const g = Math.round(243 - t * (243 - 84));
  const b = Math.round(226 - t * (226 - 47));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function HomeScreen() {
  const { top } = useSafeAreaInsets();
  const { token: paramToken } = useLocalSearchParams();
  const { token: contextToken, checkInResults } = useAuth();
  const token = contextToken ?? paramToken;
  const totalSaved = 362;
  const streak = 3;
  const [dayOffset, setDayOffset] = useState(0);
  const [checkInVisible, setCheckInVisible] = useState(false);
  const panStartOffset = useRef(0);
  const [eventCounts, setEventCounts] = useState<{ [key: string]: number }>({});
  // Track which "YYYY-M" months have already been fetched so we don't re-request
  const [fetchedMonths, setFetchedMonths] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const totals: Record<string, number> = {};
    checkInResults
      .filter(r => r.visited)
      .forEach(r => { totals[r.category] = (totals[r.category] || 0) + r.amount; });
    return CATEGORY_META.map(meta => ({
      ...meta,
      amount: totals[meta.name] || 0,
      fill: Math.min((totals[meta.name] || 0) / meta.budget, 1),
    }));
  }, [checkInResults]);

  const visibleDates = getVisibleDates(dayOffset);

  useEffect(() => {
    if (!token) return;

    // Visible days can straddle months — collect every unique year-month pair
    const needed = Array.from(
      new Set(visibleDates.map(d => `${d.getFullYear()}-${d.getMonth()}`))
    ).filter(key => !fetchedMonths.has(key));

    if (needed.length === 0) return;

    const parseEvents = (items: any[]): { [key: string]: number } => {
      const counts: { [key: string]: number } = {};
      const monthNames: Record<string, string> = {
        January: '01', February: '02', March: '03', April: '04',
        May: '05', June: '06', July: '07', August: '08',
        September: '09', October: '10', November: '11', December: '12',
      };
      items.forEach((event: any) => {
        let dateStr = '';
        if (event.start?.date) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(event.start.date)) {
            dateStr = event.start.date;
          } else {
            const match = event.start.date.match(/^[A-Za-z]+,\s([A-Za-z]+)\s(\d{1,2}),\s(\d{4})$/);
            if (match) {
              dateStr = `${match[3]}-${monthNames[match[1]]}-${match[2].padStart(2, '0')}`;
            }
          }
        } else if (event.start?.dateTime) {
          dateStr = event.start.dateTime.split('T')[0];
        }
        if (dateStr) counts[dateStr] = (counts[dateStr] || 0) + 1;
      });
      return counts;
    };

    const fetchMonth = async (year: number, month: number) => {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${monthStart.toISOString()}&timeMax=${monthEnd.toISOString()}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error('Failed to fetch events');
      return parseEvents(data.items || []);
    };

    const fetchNeeded = async () => {
      try {
        const results = await Promise.all(
          needed.map(key => {
            const [year, month] = key.split('-').map(Number);
            return fetchMonth(year, month);
          })
        );
        const merged = Object.assign({}, ...results);
        setEventCounts(prev => ({ ...prev, ...merged }));
        setFetchedMonths(prev => new Set([...prev, ...needed]));
      } catch (_) {
        // silently fail
      }
    };

    fetchNeeded();
  }, [token, dayOffset]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Week navigation ── */}
      <View style={styles.weekSection}>
        {/* Today pill */}
        <View style={styles.todayPill}>
          <TouchableOpacity onPress={() => setDayOffset(prev => prev - 7)}>
            <Image source={chevronLeft} style={[styles.chevronImg, { transform: [{ rotate: '180deg' }] }]} contentFit="contain" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDayOffset(0)}>
            <Text style={styles.todayLabel}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDayOffset(prev => prev + 7)}>
            <Image source={chevronRight} style={styles.chevronImg} contentFit="contain" />
          </TouchableOpacity>
        </View>

        {/* Day cards — swipeable day by day */}
        <GestureDetector gesture={Gesture.Pan()
          .runOnJS(true)
          .onBegin(() => { panStartOffset.current = dayOffset; })
          .onUpdate(e => {
            // ~48px per day so dragging feels 1:1 with the cards
            const delta = Math.round(-e.translationX / 48);
            setDayOffset(panStartOffset.current + delta);
          })
        }>
          <View style={styles.weekRow}>
            {visibleDates.map((date, i) => {
              const count = eventCounts[toDateStr(date)] || 0;
              return (
                <View key={i} style={styles.dayCard}>
                  <Text style={styles.dayLabel}>{DAY_NAMES[date.getDay()]}</Text>
                  <View style={[styles.dayCircle, { backgroundColor: getHeatmapColor(count) }]}>
                    <Text style={styles.dayNumber}>{date.getDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </GestureDetector>
      </View>

      {/* ── Hero card ── */}
      <View style={styles.heroCard}>
        {/* Content row */}
        <View style={styles.heroContent}>
          {/* Savings amount */}
          <View style={styles.savingsGroup}>
            <View style={styles.savingsAmountRow}>
              <Image source={dollarSignLarge} style={styles.dollarLarge} contentFit="contain" />
              <Text style={styles.savedAmount}>{totalSaved}</Text>
            </View>
            <Text style={styles.savedLabel}>saved with Spent</Text>
          </View>

          {/* Check-in button + streak badge */}
          <View style={styles.checkInWrapper}>
            <TouchableOpacity
              style={styles.checkInButton}
              onPress={() => setCheckInVisible(true)}
            >
              <Image source={clipboardIcon} style={styles.clipboardImg} contentFit="contain" />
              <Text style={styles.checkInLabel}>check in</Text>
            </TouchableOpacity>

            <View style={styles.streakBadge}>
              <Image source={flameIcon} style={styles.flameImg} contentFit="contain" />
              <Text style={styles.streakCount}>{streak}</Text>
            </View>
          </View>
        </View>

        {/* Landscape illustration */}
        <Image
          source={heroLandscape}
          style={styles.landscapeImg}
          contentFit="cover"
        />
      </View>

      {/* ── Your Spending header ── */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleGroup}>
          <Image source={bagIcon} style={styles.sectionIconImg} contentFit="contain" />
          <Text style={styles.sectionTitle}>Your Spending</Text>
        </View>
        <TouchableOpacity style={styles.seeMorePill}>
          <Text style={styles.seeMoreText}>see more</Text>
          <Image source={seeMoreArrow} style={styles.seeMoreArrowImg} contentFit="contain" />
        </TouchableOpacity>
      </View>

      {/* ── Spending categories card ── */}
      <View style={styles.categoriesCard}>
        {categories.map((cat, i) => (
          <View
            key={cat.name}
            style={[
              styles.categoryRow,
              i < categories.length - 1 && styles.categoryDivider,
            ]}
          >
            {/* Category icon */}
            <Image source={cat.icon} style={styles.categoryIcon} contentFit="contain" />

            {/* Category name */}
            <Text style={styles.categoryName}>{cat.name}</Text>

            {/* Progress bar with budget marker */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${cat.fill * 100}%` }]} />
              <View style={[styles.budgetMarker, { left: `${cat.fill * 100}%` }]}>
                <Image source={budgetMarkerLine} style={styles.budgetMarkerImg} contentFit="fill" />
              </View>
            </View>

            {/* Amount */}
            <View style={styles.amountGroup}>
              <Image source={dollarSignSmall} style={styles.dollarSmall} contentFit="contain" />
              <Text style={styles.categoryAmount}>{cat.amount}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Upcoming Expenses header ── */}
      <View style={styles.sectionRow}>
        <Image source={calendarIcon} style={styles.calendarIconImg} contentFit="contain" />
        <Text style={styles.sectionTitle}>Upcoming Expenses</Text>
      </View>
      <CheckInModal
        visible={checkInVisible}
        onClose={() => setCheckInVisible(false)}
      />
    </ScrollView>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN  = '#0a542f';
const LIME_GREEN  = '#cdf545';
const MINT        = '#d2f3e2';
const PINK        = '#ffb5db';
const PINK_BG     = 'rgba(253,139,198,0.1)';
const LIGHT_GRAY  = '#eff0f0';
const GRAY_TEXT   = '#a5a5a5';
const BLACK       = '#1e1d19';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    gap: 20,
  },

  // ── Week strip ──────────────────────────────────────────────────────────────
  weekSection: {
    alignItems: 'center',
    gap: 12,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 19,
    paddingVertical: 4,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    height: 31,
  },
  todayLabel: {
    fontSize: 16,
    color: '#000',
  },
  chevronImg: {
    width: 5,
    height: 10,
  },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 6,
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 5,
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    height: 54,
  },
  dayLabel: {
    fontSize: 9,
    color: '#8e8e93',
  },
  dayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: MINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 10,
    color: '#000',
  },

  // ── Hero card ───────────────────────────────────────────────────────────────
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: MINT,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  savingsGroup: {
    gap: 2,
  },
  savingsAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dollarLarge: {
    width: 24,
    height: 24,
  },
  savedAmount: {
    fontSize: 32,
    color: DARK_GREEN,
    fontWeight: '400',
  },
  savedLabel: {
    fontSize: 10,
    color: DARK_GREEN,
  },
  checkInWrapper: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 5,
  },
  checkInButton: {
    borderWidth: 1,
    borderColor: DARK_GREEN,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 5,
    width: 74,
    shadowColor: '#fff',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
  },
  clipboardImg: {
    width: 16,
    height: 20,
  },
  checkInLabel: {
    fontSize: 10,
    color: DARK_GREEN,
    fontWeight: '700',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: DARK_GREEN,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flameImg: {
    width: 9,
    height: 11,
  },
  streakCount: {
    fontSize: 10,
    color: LIME_GREEN,
  },
  landscapeImg: {
    width: '100%',
    height: 112,
  },

  // ── Section headers ─────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconImg: {
    width: 17,
    height: 20,
  },
  calendarIconImg: {
    width: 20,
    height: 18,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    color: BLACK,
    fontWeight: '400',
  },
  seeMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_GRAY,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  seeMoreText: {
    fontSize: 10,
    color: GRAY_TEXT,
    fontWeight: '700',
  },
  seeMoreArrowImg: {
    width: 8,
    height: 8,
  },

  // ── Categories card ─────────────────────────────────────────────────────────
  categoriesCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    gap: 7,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  categoryDivider: {
    paddingBottom: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  categoryIcon: {
    width: 20,
    height: 20,
  },
  categoryName: {
    fontSize: 10,
    color: BLACK,
    width: 74,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: PINK_BG,
    borderRadius: 10,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: 10,
    backgroundColor: PINK,
    borderRadius: 10,
  },
  budgetMarker: {
    position: 'absolute',
    top: -5.75,
    width: 1,
    height: 21.5,
    marginLeft: -0.5,
  },
  budgetMarkerImg: {
    width: 1,
    height: 21.5,
  },
  amountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  dollarSmall: {
    width: 16,
    height: 16,
  },
  categoryAmount: {
    fontSize: 16,
    color: BLACK,
    fontWeight: '400',
  },
});
