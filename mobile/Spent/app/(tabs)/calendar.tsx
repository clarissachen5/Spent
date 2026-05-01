import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAuth, SpendingEstimate } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/config';
import { getFirestore, setDoc, doc } from 'firebase/firestore';
import { app } from '../../src/config/firebase';
import PredictiveGraphRow from '../../components/PredictiveGraphRow';

// ── Assets ────────────────────────────────────────────────────────────────────
const chevronLeft  = require('../../assets/icons/chevronLeft.svg');
const chevronRight = require('../../assets/icons/chevronRight.svg');
const calendarIcon = require('../../assets/icons/calendarIcon.svg');
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const LIME_GREEN = '#cdf545';
const DARK_TEXT  = '#1e1d19';
const DARK_GREEN = '#5a8a2a';
const DEEP_GREEN = '#0a542f';
const MINT       = '#d2f3e2';
const GRAY_TEXT  = '#a5a5a5';

// Pastel bg per category for check-in pills (image 5)
const CATEGORY_PILL_BG: Record<string, string> = {
  'Eating Out':   '#e4f3ff',
  Groceries:      '#e2f1d4',
  Coffee:         '#fde4ec',
  Transportation: '#ffe7d4',
  Entertainment:  '#ece0f8',
  Shopping:       '#fff1d6',
};
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string | null; // ISO datetime string, null = all-day
  endTime:   string | null;
  isAllDay:  boolean;
}

// dollars 0 → lightest lime; HEATMAP_MAX ($100) → full lime
const HEATMAP_MAX = 100;
function getHeatmapColor(dollars: number): string {
  if (!dollars) return 'rgba(205, 245, 69, 0.15)';
  const t = Math.min(dollars, HEATMAP_MAX) / HEATMAP_MAX;
  const opacity = 0.15 + t * 0.85;
  return `rgba(205, 245, 69, ${opacity.toFixed(2)})`;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d       = new Date(iso);
  const hours   = d.getHours();
  const minutes = d.getMinutes();
  const ampm    = hours >= 12 ? 'PM' : 'AM';
  const h       = hours % 12 || 12;
  const m       = String(minutes).padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    // All-day events first
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    if (!a.startTime || !b.startTime) return 0;
    return a.startTime.localeCompare(b.startTime);
  });
}

export default function CalendarScreen() {
  const { top }   = useSafeAreaInsets();
  const { token, userId, checkInResults, predictions, mergePredictions, predictionsLoaded, updateCheckIn, removeCheckIn } = useAuth();

  const [monthOffset, setMonthOffset]       = useState(0);
  const [eventsByDate, setEventsByDate]     = useState<{ [dateStr: string]: CalendarEvent[] }>({});
  const [fetchedMonths, setFetchedMonths]   = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [graphRowWidth, setGraphRowWidth]   = useState(0);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editValue, setEditValue]           = useState('');

  // Normalize event titles so minor differences (case, whitespace) don't break matching
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  // Build lookup maps from Ollama predictions
  const predictedTotalsByDate: { [date: string]: number } = {};
  const predictedByEventKey: { [key: string]: { amount: number; description: string } } = {};
  predictions.forEach((p: SpendingEstimate) => {
    const rawAmt = Number(p.medium?.amount ?? 0);
    const amt    = Number.isFinite(rawAmt) ? rawAmt : 0;
    predictedTotalsByDate[p.date] = (predictedTotalsByDate[p.date] || 0) + amt;
    predictedByEventKey[`${p.date}|${norm(p.event)}`] = {
      amount: amt,
      description: p.medium?.description ?? '',
    };
  });

  const today       = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year        = displayDate.getFullYear();
  const month       = displayDate.getMonth();

  // ── One-time Ollama sync across ±6 months from today ────────────────────
  useEffect(() => {
    if (!token || !userId || !predictionsLoaded) return;

    const syncOllama = async () => {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 7, 0, 23, 59, 59);

      let allItems: any[] = [];
      try {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
          `?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}` +
          `&singleEvents=true&orderBy=startTime&maxResults=2500`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (!res.ok) { console.warn('[Calendar OllamaSync] Google error:', data); return; }
        allItems = data.items || [];
      } catch (e) {
        console.warn('[Calendar OllamaSync] fetch failed:', e);
        return;
      }

      const coveredKeys = new Set(predictions.map((p: SpendingEstimate) => `${p.date}|${norm(p.event)}`));
      const allEvents   = allItems.flatMap((event: any) => {
        const dateStr = event.start?.date ?? event.start?.dateTime?.split('T')[0] ?? '';
        const title   = event.summary ?? '(No title)';
        return dateStr ? [{ date: dateStr, title }] : [];
      });

      const uncovered = allEvents.filter(e => !coveredKeys.has(`${e.date}|${norm(e.title)}`));

      // Anchor sort to the last date that already has a prediction (fall back to today)
      const anchorDate = predictions.length > 0
        ? predictions.reduce((best, p) => (p.date > best ? p.date : best), predictions[0].date)
        : now.toISOString().split('T')[0];
      const anchorMs = new Date(anchorDate + 'T12:00:00').getTime();
      uncovered.sort((a, b) => {
        const distA = Math.abs(new Date(a.date + 'T12:00:00').getTime() - anchorMs);
        const distB = Math.abs(new Date(b.date + 'T12:00:00').getTime() - anchorMs);
        return distA - distB;
      });
      console.log('[Calendar OllamaSync] uncovered:', uncovered.length, 'events; anchor date:', anchorDate);
      if (uncovered.length === 0) return;

      const db = getFirestore(app);
      const BATCH = 20;

      // Process each batch independently — save + update UI immediately when each resolves
      const processBatch = async (batch: { date: string; title: string }[]) => {
        try {
          const ollamaRes = await fetch(`${API_BASE_URL}/ollama/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: batch }),
          });
          if (!ollamaRes.ok) { console.warn('[OllamaSync] non-ok response', ollamaRes.status); return; }
          const analysis = await ollamaRes.json();
          console.log('[OllamaSync] raw analysis keys:', Object.keys(analysis));

          let estimates: SpendingEstimate[] = [];
          try {
            if (analysis.parsed_estimates) {
              const parsed = typeof analysis.parsed_estimates === 'string'
                ? JSON.parse(analysis.parsed_estimates)
                : analysis.parsed_estimates;
              estimates = parsed.estimates ?? (Array.isArray(parsed) ? parsed : []);
            } else if (analysis.raw_response) {
              const match = analysis.raw_response.match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                estimates = parsed.estimates ?? (Array.isArray(parsed) ? parsed : []);
              }
            }
          } catch (parseErr) {
            console.warn('[OllamaSync] parse error:', parseErr, 'raw:', JSON.stringify(analysis).slice(0, 300));
          }

          console.log('[OllamaSync] parsed', estimates.length, 'estimates from batch of', batch.length);
          if (estimates.length === 0) return;

          // Update calendar UI immediately
          mergePredictions(estimates);
          console.log('[OllamaSync] mergePredictions called with', estimates.length, 'estimates');

          // Save to Firestore — await so errors are visible
          const savedAt = new Date().toISOString();
          try {
            await Promise.all(estimates.map((p: SpendingEstimate) =>
              setDoc(doc(db, 'users', userId!, 'spending_analyses', `${p.date}__${p.event.replace(/\//g, '-')}`.slice(0, 500)), {
                date: p.date, event: p.event,
                low: p.low, medium: p.medium, high: p.high,
                created_at: savedAt,
              })
            ));
            console.log('[OllamaSync] Firestore saved', estimates.length, 'predictions');
          } catch (fsErr) {
            console.warn('[OllamaSync] Firestore save failed:', fsErr);
          }
        } catch (e) {
          console.warn('[OllamaSync] batch failed (backend may be offline):', (e as any)?.message);
        }
      };

      // Fire all batches sequentially so Ollama isn't overwhelmed,
      // but each saves + updates the calendar the moment it completes
      for (let i = 0; i < uncovered.length; i += BATCH) {
        await processBatch(uncovered.slice(i, i + BATCH));
      }
    };

    syncOllama();
  }, [token, predictionsLoaded]);  // runs once when ready

  // ── Fetch events for the displayed month ──────────────────────────────────
  useEffect(() => {
    if (!token || !userId || !predictionsLoaded) return;
    const key = `${year}-${month}`;
    if (fetchedMonths.has(key)) return;

    const fetchEvents = async () => {
      // 1. Fetch Google Calendar events for this month
      const start = new Date(year, month, 1);
      const end   = new Date(year, month + 1, 0, 23, 59, 59);
      let items: any[] = [];
      try {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
          `?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}` +
          `&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (!res.ok) { console.warn('[Calendar] Google API error:', data); return; }
        items = data.items || [];
      } catch (e) {
        console.warn('[Calendar] fetch failed:', e);
        return;
      }

      // 2. Build byDate map
      const byDate: { [dateStr: string]: CalendarEvent[] } = {};
      items.forEach((event: any) => {
        let dateStr  = '';
        let isAllDay = false;
        let startTime: string | null = null;
        let endTime:   string | null = null;

        if (event.start?.date) {
          dateStr  = /^\d{4}-\d{2}-\d{2}$/.test(event.start.date) ? event.start.date : '';
          isAllDay = true;
        } else if (event.start?.dateTime) {
          dateStr   = event.start.dateTime.split('T')[0];
          startTime = event.start.dateTime;
          endTime   = event.end?.dateTime ?? null;
        }
        if (!dateStr) return;
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push({
          id: event.id ?? `${dateStr}-${Math.random()}`,
          title: event.summary ?? '(No title)',
          startTime, endTime, isAllDay,
        });
      });

      setEventsByDate(prev => ({ ...prev, ...byDate }));
      setFetchedMonths(prev => new Set([...prev, key]));
      console.log('[Calendar] loaded', items.length, 'events,', predictions.length, 'predictions in state');

      // 3. Find events not yet covered by spending_analyses (normalize titles)
      const coveredKeys = new Set(predictions.map((p: SpendingEstimate) => `${p.date}|${norm(p.event)}`));
      const allEvents   = Object.entries(byDate).flatMap(([date, evs]) =>
        evs.map(ev => ({ date, title: ev.title }))
      );
      const uncovered = allEvents.filter(e => !coveredKeys.has(`${e.date}|${norm(e.title)}`));
      const todayMs = new Date().getTime();
      uncovered.sort((a, b) => {
        const distA = Math.abs(new Date(a.date + 'T12:00:00').getTime() - todayMs);
        const distB = Math.abs(new Date(b.date + 'T12:00:00').getTime() - todayMs);
        return distA - distB;
      });
      console.log('[Calendar] covered:', allEvents.length - uncovered.length, 'uncovered:', uncovered.length);

      // 4. Send uncovered events to Ollama, save results to Firestore
      if (uncovered.length === 0) return;
      const BATCH = 20;
      const allEstimates: SpendingEstimate[] = [];
      for (let i = 0; i < uncovered.length; i += BATCH) {
        const batch = uncovered.slice(i, i + BATCH);
        try {
          const ollamaRes = await fetch(`${API_BASE_URL}/ollama/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: batch }),
          });
          if (!ollamaRes.ok) { console.warn('[Ollama] non-ok response'); continue; }
          const analysis = await ollamaRes.json();
          let estimates: SpendingEstimate[] = [];
          try {
            estimates = analysis.parsed_estimates
              ? JSON.parse(analysis.parsed_estimates).estimates ?? []
              : JSON.parse(analysis.raw_response?.match(/\{[\s\S]*\}/)?.[0] ?? '{}').estimates ?? [];
          } catch (_) {}
          allEstimates.push(...estimates);
        } catch (e) {
          console.warn('[Ollama] batch failed (backend may be offline):', (e as any)?.message);
        }
      }

      if (allEstimates.length > 0) {
        mergePredictions(allEstimates);
        try {
          const db = getFirestore(app);
          const savedAt = new Date().toISOString();
          await Promise.all(allEstimates.map((p: SpendingEstimate) =>
            setDoc(doc(db, 'users', userId!, 'spending_analyses', `${p.date}__${p.event.replace(/\//g, '-')}`.slice(0, 500)), {
              date: p.date, event: p.event,
              low: p.low, medium: p.medium, high: p.high,
              created_at: savedAt,
            })
          ));
          console.log('[Firestore] saved', allEstimates.length, 'new predictions');
        } catch (e) {
          console.warn('[Firestore] save failed:', e);
        }
      }
    };

    fetchEvents();
  }, [token, year, month, predictionsLoaded]);

  // ── Build calendar grid ───────────────────────────────────────────────────
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth    = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  // ── Swipe gesture ─────────────────────────────────────────────────────────
  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(40)
    .onEnd(e => {
      if (Math.abs(e.translationX) <= Math.abs(e.translationY)) return;
      if (e.translationX < -50) setMonthOffset(prev => prev + 1);
      else if (e.translationX > 50) setMonthOffset(prev => prev - 1);
    });

  // ── Selected day data ─────────────────────────────────────────────────────
  const selectedEvents = selectedDate ? sortEvents(eventsByDate[selectedDate] ?? []) : [];

  const selectedCheckIns = selectedDate
    ? checkInResults.filter(r => {
        if (!r.visited) return false;
        const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return ds === selectedDate;
      })
    : [];

  const selectedDay = selectedDate
    ? new Date(selectedDate + 'T12:00:00')
    : null;

  // ── Check-in dollar totals by date ──────────────────────────────────────
  const checkInTotalsByDate: { [date: string]: number } = {};
  checkInResults.forEach(r => {
    if (!r.visited) return;
    const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    checkInTotalsByDate[ds] = (checkInTotalsByDate[ds] ?? 0) + (r.amount ?? 0);
  });

  // ── Normalization caps across the whole month ────────────────────────────
  let monthMaxCheckIn  = 1;
  let monthMaxSpending = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(year, month, d);
    monthMaxCheckIn  = Math.max(monthMaxCheckIn,  checkInTotalsByDate[ds] ?? 0);
    monthMaxSpending = Math.max(monthMaxSpending, predictedTotalsByDate[ds] ?? 0);
  }

  // Helper to figure out which column (0–6) the currently-selected date is in,
  // for a given row
  const selectedDayNum = selectedDate
    ? Number(selectedDate.split('-')[2])
    : null;
  const selectedMonthMatches = selectedDate
    ? selectedDate.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
    : false;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: top + 16 }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <TouchableOpacity hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Image source={calendarIcon} style={styles.pageIcon} contentFit="contain" />
        <Text style={styles.pageTitle}>Predictive Calendar</Text>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <View style={styles.calendarCard}>

          {/* Month navigation — circular green arrows */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setMonthOffset(prev => prev - 1)}
              style={styles.monthArrowBtn}
              hitSlop={10}
            >
              <Text style={styles.monthArrowText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonthOffset(0)}>
              <Text style={styles.monthLabel}>{MONTH_NAMES[month]}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMonthOffset(prev => prev + 1)}
              style={styles.monthArrowBtn}
              hitSlop={10}
            >
              <Text style={styles.monthArrowText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View
            style={styles.dayHeaderRow}
            onLayout={e => setGraphRowWidth(e.nativeEvent.layout.width)}
          >
            {DAY_NAMES.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Weekly graph rows */}
          {graphRowWidth > 0 && rows.map((row, ri) => {
            const eventsArr   = row.map(d => d ? (checkInTotalsByDate[toDateStr(year, month, d)] ?? 0) : 0);
            const spendingArr = row.map(d => d ? (predictedTotalsByDate[toDateStr(year, month, d)] ?? 0) : 0);
            const blanks      = row.map(d => d == null);

            // Is the selected day in this row?
            let selIndex: number | undefined = undefined;
            if (selectedMonthMatches && selectedDayNum != null) {
              const idx = row.findIndex(d => d === selectedDayNum);
              if (idx >= 0) selIndex = idx;
            }

            const tooltipSpend = selIndex != null && selectedDate
              ? (predictedTotalsByDate[selectedDate] ?? 0)
              : 0;
            const tooltipCheck = selIndex != null && selectedDate
              ? checkInResults
                  .filter(r => {
                    if (!r.visited) return false;
                    const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
                    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return ds === selectedDate;
                  })
                  .reduce((s, r) => s + (r.amount ?? 0), 0)
              : 0;

            return (
              <View key={ri} style={styles.weekRowGraph}>
                {selIndex != null && (tooltipSpend > 0 || tooltipCheck > 0) && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tooltip,
                      { left: (selIndex + 0.5) * (graphRowWidth / 7) - 32 },
                    ]}
                  >
                    <Text style={styles.tooltipActual}>${tooltipCheck.toFixed(0)}</Text>
                    {tooltipSpend > 0 && (
                      <Text style={styles.tooltipPredicted}> ${tooltipSpend.toFixed(0)}</Text>
                    )}
                  </View>
                )}
                <PredictiveGraphRow
                  width={graphRowWidth}
                  height={56}
                  events={eventsArr}
                  spending={spendingArr}
                  maxEvents={monthMaxCheckIn}
                  maxSpending={monthMaxSpending}
                  blanks={blanks}
                  dayNumbers={row}
                  selectedIndex={selIndex}
                  onDayPress={i => {
                    const day = row[i];
                    if (day == null) return;
                    const ds = toDateStr(year, month, day);
                    setSelectedDate(ds === selectedDate ? null : ds);
                  }}
                />
              </View>
            );
          })}

        </View>
      </GestureDetector>

      {/* ── Check-ins for selected day ── */}
      {selectedDate && selectedCheckIns.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listLabel}>CHECK IN</Text>
          {selectedCheckIns.map((r, i) => {
            const bg = CATEGORY_PILL_BG[r.category] ?? CATEGORY_PILL_BG.Other;
            const isEditing = editingId != null && editingId === r.firestoreId;
            return (
              <View key={`checkin-${i}`} style={[styles.checkInPill, { backgroundColor: bg }]}>
                <Text style={styles.checkInName} numberOfLines={1}>{r.location}</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.checkInAmountInput}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={styles.checkInAmountNew}>${r.amount ?? 0}</Text>
                )}
                <TouchableOpacity
                  style={[styles.editDot, isEditing && styles.saveDot]}
                  onPress={async () => {
                    if (!isEditing) {
                      setEditingId(r.firestoreId ?? null);
                      setEditValue(String(r.amount ?? 0));
                    } else {
                      const num = parseFloat(editValue);
                      setEditingId(null);
                      if (!r.firestoreId) return;
                      if (isNaN(num) || num <= 0) {
                        await removeCheckIn(r.firestoreId);
                      } else {
                        await updateCheckIn(r.firestoreId, num);
                      }
                    }
                  }}
                >
                  <Text style={[styles.editDotText, isEditing && styles.saveDotText]}>
                    {isEditing ? '✓' : '✎'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Upcoming events ── */}
      {selectedDate && selectedEvents.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listLabel}>UPCOMING EVENTS</Text>
          {selectedEvents.map((item, i) => {
            const pred = predictedByEventKey[`${selectedDate}|${norm(item.title)}`];
            const accentColors = ['#c9d8a0', '#b7d4ff', '#d8c4ef', '#ffd6a0'];
            const accent = accentColors[i % accentColors.length];
            return (
              <View key={item.id} style={styles.eventRowNew}>
                <View style={[styles.eventTimeBlock, { borderLeftColor: accent }]}>
                  {item.isAllDay ? (
                    <Text style={styles.eventTimeNew}>All day</Text>
                  ) : (
                    <>
                      <Text style={styles.eventTimeNew}>
                        {item.startTime ? formatTime(item.startTime).toLowerCase().replace(/\s/g, '') : '—'}
                      </Text>
                      {item.endTime && (
                        <Text style={styles.eventTimeNew}>
                          {formatTime(item.endTime).toLowerCase().replace(/\s/g, '')}
                        </Text>
                      )}
                    </>
                  )}
                </View>
                <Text style={styles.eventTitleNew} numberOfLines={2}>{item.title}</Text>
                {pred && pred.amount > 0 && (
                  <View style={styles.eventSpendPill}>
                    <Text style={styles.eventSpendText}>${pred.amount.toFixed(2)}</Text>
                    <Text style={styles.eventSpendSparkle}>✦</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {selectedDate && selectedCheckIns.length === 0 && selectedEvents.length === 0 && (
        <Text style={styles.noEventsText}>No events on this day</Text>
      )}

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CARD_PADDING = 20;
const CELL_SIZE    = Math.floor((SCREEN_WIDTH - 48 - CARD_PADDING * 2) / 7);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  pageIcon: { width: 20, height: 18 },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK_TEXT,
  },

  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: CARD_PADDING,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  // Month nav
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chevron: { width: 7, height: 12 },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: DARK_TEXT,
  },

  // Day headers
  dayHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  dayHeader: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 9,
    color: '#8e8e93',
    fontWeight: '600',
  },

  // Grid
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    position: 'absolute',
    width:        CELL_SIZE - 4,
    height:       CELL_SIZE - 4,
    borderRadius: (CELL_SIZE - 4) / 2,
  },
  selectedRing: {
    borderWidth: 2,
    borderColor: LIME_GREEN,
  },
  dayNumber: { fontSize: 11, color: '#1e1d19' },
  selectedNumber: { fontWeight: '700', color: DARK_TEXT },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 14,
  },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendLabel: { fontSize: 10, color: '#8e8e93' },

  // Events panel
  eventsPanel: {
    marginTop: 20,
    flex: 1,
  },
  eventsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eventsPanelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  closeBtn: {
    fontSize: 14,
    color: '#8e8e93',
    fontWeight: '600',
  },
  noEventsText: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 16,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8e8e93',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Check-in specific
  checkInAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  checkInDot: {
    backgroundColor: MINT,
    borderWidth: 1.5,
    borderColor: LIME_GREEN,
  },

  // Event rows
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  eventTimePart: {
    width: 58,
    alignItems: 'flex-end',
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  eventTimeEnd: {
    fontSize: 10,
    color: '#8e8e93',
    marginTop: 1,
  },
  allDayBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: DARK_TEXT,
    backgroundColor: MINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: LIME_GREEN,
  },
  eventTitle: {
    flex: 1,
    fontSize: 13,
    color: '#1e1d19',
  },
  eventEstimate: {
    fontSize: 11,
    fontWeight: '600',
    color: DARK_GREEN,
    marginTop: 2,
  },
  dayTotalText: {
    fontSize: 11,
    color: DARK_GREEN,
    fontWeight: '600',
    marginTop: 2,
  },
  eventDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f0f0',
  },

  // ── New styles for the redesigned (Figma image 5) calendar page ──
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  backArrow: {
    fontSize: 22,
    color: DARK_TEXT,
    fontWeight: '400',
    lineHeight: 24,
  },
  monthArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DEEP_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
    lineHeight: 18,
  },
  weekRowGraph: {
    position: 'relative',
    marginBottom: 6,
  },
  tooltip: {
    position: 'absolute',
    top: -22,
    width: 64,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    paddingVertical: 3,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tooltipActual: {
    fontSize: 11,
    fontWeight: '700',
    color: DEEP_GREEN,
  },
  tooltipPredicted: {
    fontSize: 11,
    fontWeight: '500',
    color: GRAY_TEXT,
  },
  listSection: {
    marginTop: 24,
    gap: 8,
  },
  listLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: GRAY_TEXT,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  checkInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 100,
  },
  checkInName: {
    flex: 1,
    fontSize: 14,
    color: DARK_TEXT,
    fontWeight: '500',
  },
  checkInAmountNew: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  editDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#c9c9c9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDotText: {
    fontSize: 10,
    color: '#6b6b6b',
  },
  saveDot: {
    backgroundColor: DEEP_GREEN,
    borderColor: DEEP_GREEN,
  },
  saveDotText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  checkInAmountInput: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_TEXT,
    borderBottomWidth: 1,
    borderBottomColor: DEEP_GREEN,
    minWidth: 50,
    textAlign: 'right',
    paddingVertical: 0,
  },
  eventRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  eventTimeBlock: {
    width: 62,
    borderLeftWidth: 3,
    paddingLeft: 8,
  },
  eventTimeNew: {
    fontSize: 11,
    color: DARK_TEXT,
    fontWeight: '600',
  },
  eventTitleNew: {
    flex: 1,
    fontSize: 13,
    color: DARK_TEXT,
    fontWeight: '500',
  },
  eventSpendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#c9c9c9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  eventSpendText: {
    fontSize: 12,
    fontWeight: '700',
    color: DARK_TEXT,
  },
  eventSpendSparkle: {
    fontSize: 10,
    color: '#f0b400',
  },
});
