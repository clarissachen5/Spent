import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import CheckInModal from '../../components/CheckInModal';
import PredictiveGraphRow from '../../components/PredictiveGraphRow';
import PigAnimation from '../../components/PigAnimation';
import { API_BASE_URL } from '../../constants/config';
import { getFirestore, setDoc, doc } from 'firebase/firestore';
import { app } from '../../src/config/firebase';
import * as TaskManager from 'expo-task-manager';

// ── Figma assets (local SVGs with CSS vars resolved) ─────────────────────────
const chevronLeft        = require('../../assets/icons/chevronLeft.svg');
const chevronRight       = require('../../assets/icons/chevronRight.svg');
const clipboardIcon      = require('../../assets/icons/clipboardIcon.svg');
const flameIcon          = require('../../assets/icons/flameIcon.svg');
const bagIcon            = require('../../assets/icons/bagIcon.svg');

// ── Farm background images (1 = worst, 5 = best) ─────────────────────────────
const FARM_IMAGES = [
  require('../../assets/images/1.jpg'),
  require('../../assets/images/2.jpg'),
  require('../../assets/images/3.jpg'),
  require('../../assets/images/4.jpg'),
  require('../../assets/images/5.jpg'),
];
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

const CATEGORY_CONFIG = [
  { name: 'Eating Out',     icon: foodIcon           },
  { name: 'Groceries',      icon: bagIcon            },
  { name: 'Coffee',         icon: coffeeIcon         },
  { name: 'Transportation', icon: transportationIcon },
  { name: 'Entertainment',  icon: entertainmentIcon  },
  { name: 'Shopping',       icon: shoppingIcon       },
];

// Fallback max per category when no budget has been saved yet
const DEFAULT_CATEGORY_MAX = 100;

// Category → color for upcoming expense cards (bg = light track, bar = accent)
const PRED_CAT_BG: Record<string, string> = {
  'Eating Out':    '#e4f3ff',
  Groceries:       '#e2f1d4',
  Coffee:          '#fde4ec',
  Transportation:  '#ffe7d4',
  Entertainment:   '#ece0f8',
  Shopping:        '#fff1d6',
};
const PRED_CAT_BAR: Record<string, string> = {
  'Eating Out':    '#9ED3F0',
  Groceries:       '#A8D8A8',
  Coffee:          '#F4B8C8',
  Transportation:  '#FFCBA4',
  Entertainment:   '#C9A8E8',
  Shopping:        '#FCB842',
};
// Fallback rotating palette for uncategorised predictions
const PRED_FALLBACK = [
  { bg: '#eefbfd', bar: '#a8eaf6' },
  { bg: '#fff6d6', bar: '#fed130' },
  { bg: '#f8eeff', bar: '#deabff' },
  { bg: '#fff0f8', bar: '#ffb5db' },
  { bg: '#ffeddd', bar: '#ffcba4' },
  { bg: '#e2f1d4', bar: '#a8d8a8' },
];
function predColor(category: string | undefined, index: number): { bg: string; bar: string } {
  if (category && PRED_CAT_BG[category]) {
    return { bg: PRED_CAT_BG[category], bar: PRED_CAT_BAR[category] };
  }
  return PRED_FALLBACK[index % PRED_FALLBACK.length];
}

// Per-category colors for the category bars (figma "April Spending" section)
const CATEGORY_BAR: Record<string, string> = {
  'Eating Out':    '#9ED3F0',
  Groceries:       '#A8D8A8',
  Coffee:          '#F4B8C8',
  Transportation:  '#FFCBA4',
  Entertainment:   '#C9A8E8',
  Shopping:        '#FCB842',
};
const CATEGORY_TRACK: Record<string, string> = {
  'Eating Out':    '#e4f3ff',
  Groceries:       '#e2f1d4',
  Coffee:          '#fde4ec',
  Transportation:  '#ffe7d4',
  Entertainment:   '#ece0f8',
  Shopping:        '#fff1d6',
};
const CATEGORY_PILL_BG: Record<string, string> = {
  'Eating Out':    '#e4f3ff',
  Groceries:       '#e2f1d4',
  Coffee:          '#fde4ec',
  Transportation:  '#ffe7d4',
  Entertainment:   '#ece0f8',
  Shopping:        '#fff1d6',
};

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

// Green heatmap: no events = mint, more events = lime green
function getHeatmapColor(count: number): string {
  if (!count) return '#d2f3e2';
  const t = Math.min(count, 5) / 5;
  // interpolate from mint #d2f3e2 → lime green #cdf545
  const r = Math.round(210 - t * (210 - 205));
  const g = Math.round(243 - t * (243 - 245));
  const b = Math.round(226 - t * (226 - 69));
  return `rgb(${r}, ${g}, ${b})`;
}

const LOCATION_TASK_NAME = 'spent-background-location';

export default function HomeScreen() {
  const { top } = useSafeAreaInsets();
  const { token: paramToken, checkIn } = useLocalSearchParams();
  const { token: contextToken, checkInResults, predictions, mergePredictions, predictionsLoaded, pendingLocations, monthlyBudget, userProfile } = useAuth();
  const token = contextToken ?? paramToken;
  const [trackingActive, setTrackingActive] = useState(false);
  const [farmAspectRatio, setFarmAspectRatio] = useState(1);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const check = async () => {
      const active = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      setTrackingActive(active);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const categoryTotals = useMemo(() => {
    const now = new Date();
    const totals: { [key: string]: number } = {};
    checkInResults.forEach(r => {
      if (!r.visited || r.amount == null) return;
      const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
      totals[r.category] = (totals[r.category] || 0) + r.amount;
    });
    return totals;
  }, [checkInResults]);

  // Merge preset categories with any custom ones from user profile
  const allCategoryConfig = useMemo(() => {
    const presetNames = new Set(CATEGORY_CONFIG.map(c => c.name));
    const custom = (userProfile?.categories ?? [])
      .filter(name => !presetNames.has(name))
      .map(name => ({ name, icon: otherIcon }));
    return [...CATEGORY_CONFIG, ...custom];
  }, [userProfile?.categories]);

  // Pick farm background + spending score based on actual spend vs monthly budget
  const { farmImage, spendingScore } = useMemo(() => {
    const totalSpent  = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
    const totalBudget = Object.values(monthlyBudget).reduce((s, v) => s + v, 0);

    if (totalBudget === 0 || totalSpent === 0) return { farmImage: FARM_IMAGES[2], spendingScore: 3 };

    const ratio = totalSpent / totalBudget;
    if (ratio > 1.2) return { farmImage: FARM_IMAGES[0], spendingScore: 1 };
    if (ratio > 1.0) return { farmImage: FARM_IMAGES[1], spendingScore: 2 };
    if (ratio > 0.8) return { farmImage: FARM_IMAGES[2], spendingScore: 3 };
    if (ratio > 0.5) return { farmImage: FARM_IMAGES[3], spendingScore: 4 };
    return { farmImage: FARM_IMAGES[4], spendingScore: 5 };
  }, [categoryTotals, monthlyBudget]);

  // Pig accessories — show when user has checked in to that category this month
  const pigAccessories = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const map: Record<string, string> = {
      Coffee:          'coffee_off',
      'Eating Out':    'necklace_off',
      Shopping:        'glasses_off',
      Entertainment:   'crown_off',
      Transportation:  'wings_off',
    };
    const acc: Record<string, boolean> = {};
    Object.entries(map).forEach(([cat, input]) => {
      const hasCheckin = checkInResults.some(r => {
        if (!r.visited || r.category !== cat) return false;
        const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
        const dStr = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        return dStr === todayStr;
      });
      acc[input] = !hasCheckin; // _off = true means hidden, false means visible
    });
    return acc;
  }, [checkInResults]);

  // Sum medium predicted spend per day
  const predictedTotalsByDate = useMemo(() => {
    const totals: { [date: string]: number } = {};
    predictions.forEach(p => {
      totals[p.date] = (totals[p.date] || 0) + Number(p.medium?.amount ?? 0);
    });
    return totals;
  }, [predictions]);

  const streak = 3;
  const monthNameUpper = new Date()
    .toLocaleString('default', { month: 'long' })
    .toUpperCase();
  const [dayOffset, setDayOffset] = useState(0);
  const [checkInVisible, setCheckInVisible] = useState(false);
  const [graphWidth, setGraphWidth] = useState(0);
  const panStartOffset = useRef(0);

  useEffect(() => {
    if (checkIn) setCheckInVisible(true);
  }, [checkIn]);
  const [eventCounts, setEventCounts] = useState<{ [key: string]: number }>({});
  // Track which "YYYY-M" months have already been fetched so we don't re-request
  const [fetchedMonths, setFetchedMonths] = useState<Set<string>>(new Set());

  const visibleDates = getVisibleDates(dayOffset);

  useEffect(() => {
    if (!token || !predictionsLoaded) return;

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
      const items = data.items || [];
      return { counts: parseEvents(items), items };
    };

    const fetchNeeded = async () => {
      try {
        const results = await Promise.all(
          needed.map(key => {
            const [year, month] = key.split('-').map(Number);
            return fetchMonth(year, month);
          })
        );
        const mergedCounts = Object.assign({}, ...results.map(r => r.counts));
        setEventCounts(prev => ({ ...prev, ...mergedCounts }));
        setFetchedMonths(prev => new Set([...prev, ...needed]));

        // Collect upcoming events (within visible window) and send to backend
        const visibleDateStrs = new Set(visibleDates.map(toDateStr));
        console.log('[Ollama] visible date range:', [...visibleDateStrs]);

        const allItems = results.flatMap(r => r.items);
        console.log('[Ollama] total calendar items fetched:', allItems.length);

        const upcomingEvents = allItems
          .filter((ev: any) => {
            const d = ev.start?.date?.split('T')[0] ?? ev.start?.dateTime?.split('T')[0];
            return d && visibleDateStrs.has(d);
          })
          .map((ev: any) => ({
            title: ev.summary ?? 'Untitled',
            date: ev.start?.date?.split('T')[0] ?? ev.start?.dateTime?.split('T')[0],
          }));

        const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        // Filter out events already covered by Firebase predictions
        const coveredKeys = new Set(predictions.map(p => `${p.date}|${norm(p.event)}`));
        const uncoveredEvents = upcomingEvents.filter(
          e => !coveredKeys.has(`${e.date}|${norm(e.title)}`)
        );
        console.log('[Ollama] visible:', upcomingEvents.length, 'uncovered:', uncoveredEvents.length);

        if (uncoveredEvents.length > 0) {
          // Batch into groups of 5 so Ollama doesn't truncate
          const BATCH = 20;
          const allEstimates: any[] = [];
          for (let i = 0; i < uncoveredEvents.length; i += BATCH) {
            const batch = uncoveredEvents.slice(i, i + BATCH);
            try {
              const ollamaRes = await fetch(`${API_BASE_URL}/ollama/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: batch }),
              });
              if (ollamaRes.ok) {
                const analysis = await ollamaRes.json();
                let estimates: any[] = [];
                try {
                  if (analysis.parsed_estimates) {
                    estimates = JSON.parse(analysis.parsed_estimates).estimates ?? [];
                  } else {
                    const match = analysis.raw_response?.match(/\{[\s\S]*\}/);
                    if (match) estimates = JSON.parse(match[0]).estimates ?? [];
                  }
                } catch (_) {}
                allEstimates.push(...estimates);
              }
            } catch (e) {
              console.warn('[Ollama] batch failed:', e);
            }
          }

          if (allEstimates.length > 0) {
            mergePredictions(allEstimates);
            console.log('[Ollama] merged', allEstimates.length, 'predictions');

            // Save each estimate as its own document
            try {
              const db = getFirestore(app);
              const savedAt = new Date().toISOString();
              await Promise.all(allEstimates.map((p: any) =>
                setDoc(doc(db, 'spending_analyses', `${p.date}__${String(p.event).replace(/\//g, '-')}`.slice(0, 500)), {
                  date:       p.date,
                  event:      p.event,
                  low:        p.low,
                  medium:     p.medium,
                  high:       p.high,
                  created_at: savedAt,
                })
              ));
              console.log('[Firestore] analysis saved');
            } catch (e) {
              console.warn('[Firestore] save failed:', e);
            }
          }
        } else {
          console.log('[Ollama] no events in visible window — skipping backend call');
        }
      } catch (e) {
        console.warn('[fetchNeeded] error:', e);
      }
    };

    fetchNeeded();
  }, [token, dayOffset, predictionsLoaded]);

  return (
    <View style={styles.screen}>
      {/* ── Farm background — full-width, natural height, pinned to top ── */}
      <Image
        source={farmImage}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, aspectRatio: farmAspectRatio }}
        contentFit="fill"
        onLoad={e => {
          const { width, height } = e.source;
          if (width && height) setFarmAspectRatio(width / height);
        }}
      />

    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: top + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Farm transparent section — shows farm bg, overlays controls ── */}
      <View style={styles.farmSection}>
        {/* 5-step progress bar — bottom left, over pig sty */}
        <View style={styles.progressBarRow}>
          {[1, 2, 3, 4, 5].map(step => (
            <View
              key={step}
              style={[styles.progressSegment, step <= spendingScore && styles.progressSegmentFilled]}
            />
          ))}
        </View>
        {/* Animated pig — absolutely centered */}
        <View style={styles.pigContainer}>
          <PigAnimation accessories={pigAccessories} style={styles.pigAnimation} />
        </View>
        {/* Check-in + streak — bottom right */}
        <View style={styles.farmOverlayRight}>
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
      </View>

      {/* ── Location status ── */}
      {Platform.OS !== 'web' && (
        <View style={styles.locationStatus}>
          <View style={[styles.locationDot, { backgroundColor: trackingActive ? '#22c55e' : '#a5a5a5' }]} />
          <Text style={styles.locationStatusText}>
            {trackingActive ? 'Location tracking active' : 'Location tracking inactive'}
          </Text>
          {pendingLocations.length > 0 && (
            <View style={styles.locationBadge}>
              <Text style={styles.locationBadgeText}>{pendingLocations.length} new</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Predictive spending graph ── */}
      <View style={styles.sectionRow}>
        <View style={styles.predictivePill}>
          <Text style={styles.predictivePillText}>PREDICTIVE SPENDING</Text>
        </View>
      </View>

      <GestureDetector gesture={Gesture.Pan()
        .runOnJS(true)
        .minDistance(20)
        .onBegin(() => { panStartOffset.current = dayOffset; })
        .onEnd(e => {
          if (Math.abs(e.translationX) < 40) return;
          if (e.translationX < 0) setDayOffset(panStartOffset.current + 7);
          else setDayOffset(panStartOffset.current - 7);
        })
      }>
        <View
          style={styles.graphCard}
          onLayout={e => setGraphWidth(e.nativeEvent.layout.width)}
        >
          {graphWidth > 0 && (() => {
            const eventsArr   = visibleDates.map(d => eventCounts[toDateStr(d)] || 0);
            const spendingArr = visibleDates.map(d => predictedTotalsByDate[toDateStr(d)] || 0);
            return (
              <PredictiveGraphRow
                width={graphWidth}
                height={78}
                events={eventsArr}
                spending={spendingArr}
                maxEvents={Math.max(1, ...eventsArr)}
                maxSpending={Math.max(1, ...spendingArr)}
                dayLabels={visibleDates.map(d => DAY_NAMES[d.getDay()])}
                dayNumbers={visibleDates.map(d => d.getDate())}
                showDayLabels
              />
            );
          })()}
        </View>
      </GestureDetector>

      {/* ── Month spending header ── */}
      <View style={styles.sectionRow}>
        <View style={styles.predictivePill}>
          <Text style={styles.predictivePillText}>
            {monthNameUpper} SPENDING
          </Text>
        </View>
      </View>

      {/* ── Spending categories card ── */}
      <View style={styles.categoriesCard}>
        {allCategoryConfig.map((cat, i) => {
          const amount = categoryTotals[cat.name] ?? 0;
          const userMax = monthlyBudget[cat.name];
          const max    = userMax || DEFAULT_CATEGORY_MAX;
          const fill   = Math.min(amount / max, 1);
          const bar    = CATEGORY_BAR[cat.name]    ?? '#F4A0A0';
          const track  = CATEGORY_TRACK[cat.name]  ?? '#FDE0E0';
          const pill   = CATEGORY_PILL_BG[cat.name] ?? '#FDE0E0';
          return (
            <View
              key={cat.name}
              style={[
                styles.categoryRowNew,
                i < allCategoryConfig.length - 1 && styles.categoryDividerNew,
              ]}
            >
              <View style={styles.categoryTopRow}>
                <Image source={cat.icon} style={styles.categoryIconNew} contentFit="contain" />
                <Text style={styles.categoryNameNew}>{cat.name}</Text>
                <View style={[styles.amountPill, { backgroundColor: pill }]}>
                  <Text style={styles.amountPillText}>
                    ${amount}
                    {userMax ? <Text style={styles.amountPillMax}>/{userMax}</Text> : null}
                  </Text>
                </View>
              </View>
              <View style={[styles.barTrack, { backgroundColor: track }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${fill * 100}%`, backgroundColor: bar },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Upcoming Expenses header ── */}
      <View style={styles.sectionRow}>
        <View style={styles.predictivePill}>
          <Text style={styles.predictivePillText}>UPCOMING EXPENSES</Text>
        </View>
      </View>

      {/* ── Ollama predictions ── */}
      {predictions.length > 0 && (
        <View style={styles.predictionsCard}>
          {[...predictions]
            .filter(p => p.date >= toDateStr(new Date()))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 10)
            .map((p, i) => {
              const palette = predColor(p.category, i);
              const dateObj = new Date(p.date + 'T12:00:00');
              const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const dayLabel  = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const med = Number(p.medium?.amount ?? 0);
              const medStr = med % 1 === 0 ? `$${med}` : `$${med.toFixed(2)}`;
              return (
                <View key={i} style={styles.upcomingRow}>
                  <View style={[styles.upcomingDateBlock, { backgroundColor: palette.bg }]}>
                    <View style={[styles.upcomingDateBar, { backgroundColor: palette.bar }]} />
                    <View style={styles.upcomingDateTexts}>
                      <Text style={styles.upcomingDateLine}>{dateLabel}</Text>
                      <Text style={styles.upcomingDateLine}>{dayLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.upcomingEvent} numberOfLines={2}>{p.event}</Text>
                  <View style={[styles.upcomingAmtBox, { borderColor: '#0a2627' }]}>
                    <Text style={styles.upcomingAmtTxt}>{medStr}</Text>
                    <View style={[styles.upcomingAmtCircle, { backgroundColor: palette.bg }]}>
                      <Text style={styles.upcomingAmtSparkle}>✦</Text>
                    </View>
                  </View>
                </View>
              );
            })}
        </View>
      )}

      <CheckInModal
        visible={checkInVisible}
        onClose={() => setCheckInVisible(false)}
      />
    </ScrollView>
  </View>
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
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
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

  // ── Farm section (transparent — farm bg shows through) ──────────────────────
  farmSection: {
    height: 220,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  pigContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pigAnimation: {
    width: 160,
    height: 160,
  },
  farmOverlayRight: {
    alignItems: 'center',
    gap: 4,
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  progressSegment: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  progressSegmentFilled: {
    backgroundColor: LIME_GREEN,
    borderColor: LIME_GREEN,
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

  // ── Location status ─────────────────────────────────────────────────────────
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationStatusText: {
    fontSize: 12,
    color: '#555',
    flex: 1,
  },
  locationBadge: {
    backgroundColor: LIME_GREEN,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: DARK_GREEN,
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
  predictivePill: {
    borderWidth: 1.5,
    borderColor: DARK_GREEN,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: '#fff',
  },
  predictivePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: DARK_GREEN,
    letterSpacing: 0.5,
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
  seeMorePillMuted: {
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
  seeMoreTextMuted: {
    fontSize: 10,
    color: GRAY_TEXT,
    fontWeight: '700',
  },
  graphCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  categoryRowNew: {
    gap: 6,
  },
  categoryDividerNew: {
    paddingBottom: 12,
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryIconNew: {
    width: 22,
    height: 22,
  },
  categoryNameNew: {
    flex: 1,
    fontSize: 13,
    color: BLACK,
    fontWeight: '500',
  },
  amountPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    minWidth: 60,
    alignItems: 'center',
  },
  amountPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: BLACK,
  },
  amountPillMax: {
    fontSize: 11,
    fontWeight: '500',
    color: GRAY_TEXT,
  },
  barTrack: {
    height: 8,
    borderRadius: 100,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 100,
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
  predictionsCard: {
    gap: 10,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#eff0f0',
    borderRadius: 10,
    padding: 6,
  },
  upcomingDateBlock: {
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
  },
  upcomingDateBar: {
    width: 3,
    borderRadius: 2,
  },
  upcomingDateTexts: {
    gap: 5,
  },
  upcomingDateLine: {
    fontSize: 10,
    fontWeight: '500',
    color: '#0a2627',
  },
  upcomingEvent: {
    flex: 1,
    fontSize: 10,
    color: '#0a2627',
  },
  upcomingAmtBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 0.5,
    borderRadius: 5,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0.5 },
    elevation: 1,
  },
  upcomingAmtTxt: {
    fontSize: 10,
    fontWeight: '500',
    color: '#0a2627',
  },
  upcomingAmtCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingAmtSparkle: {
    fontSize: 8,
    color: '#0a2627',
    lineHeight: 10,
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
  categoryMax: {
    fontSize: 16,
    color: BLACK,
    fontWeight: '400',
  },
});
