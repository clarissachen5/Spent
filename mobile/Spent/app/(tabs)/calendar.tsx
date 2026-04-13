import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAuth, SpendingEstimate } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/config';
import { getFirestore, setDoc, doc } from 'firebase/firestore';
import { app } from '../../src/config/firebase';

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
const MINT       = '#d2f3e2';
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
  const { token, checkInResults, predictions, mergePredictions, predictionsLoaded } = useAuth();

  const [monthOffset, setMonthOffset]       = useState(0);
  const [eventsByDate, setEventsByDate]     = useState<{ [dateStr: string]: CalendarEvent[] }>({});
  const [fetchedMonths, setFetchedMonths]   = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);

  // Normalize event titles so minor differences (case, whitespace) don't break matching
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  // Build lookup maps from Ollama predictions
  const predictedTotalsByDate: { [date: string]: number } = {};
  const predictedByEventKey: { [key: string]: { amount: number; description: string } } = {};
  predictions.forEach((p: SpendingEstimate) => {
    predictedTotalsByDate[p.date] = (predictedTotalsByDate[p.date] || 0) + Number(p.medium?.amount ?? 0);
    predictedByEventKey[`${p.date}|${norm(p.event)}`] = {
    predictedByEventKey[`${p.date}|${norm(p.event)}`] = {
      amount: Number(p.medium?.amount ?? 0),
      description: p.medium?.description ?? '',
    };
  });

  const today       = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year        = displayDate.getFullYear();
  const month       = displayDate.getMonth();

  // ── One-time Ollama sync across ±6 months from today ────────────────────
  useEffect(() => {
    if (!token || !predictionsLoaded) return;

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
              setDoc(doc(db, 'spending_analyses', `${p.date}__${p.event.replace(/\//g, '-')}`.slice(0, 500)), {
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
    if (!token || !predictionsLoaded) return;
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
            setDoc(doc(db, 'spending_analyses', `${p.date}__${p.event.replace(/\//g, '-')}`.slice(0, 500)), {
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

  return (
    <View style={[styles.container, { paddingTop: top + 20 }]}>

      {/* ── Page header ── */}
      <View style={styles.pageHeader}>
        <Image source={calendarIcon} style={styles.pageIcon} contentFit="contain" />
        <Text style={styles.pageTitle}>Calendar</Text>
      </View>

      <GestureDetector gesture={swipeGesture}>
        <View style={styles.calendarCard}>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => setMonthOffset(prev => prev - 1)} hitSlop={12}>
              <Image
                source={chevronLeft}
                style={[styles.chevron, { transform: [{ rotate: '180deg' }] }]}
                contentFit="contain"
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonthOffset(0)}>
              <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonthOffset(prev => prev + 1)} hitSlop={12}>
              <Image source={chevronRight} style={styles.chevron} contentFit="contain" />
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={styles.dayHeaderRow}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.weekRow}>
              {row.map((day, di) => {
                if (!day) return <View key={di} style={styles.dayCell} />;

                const dateStr = toDateStr(year, month, day);
                const dollars = predictedTotalsByDate[dateStr] || 0;
                const isToday =
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                const isSelected = selectedDate === dateStr;

                let circleBg     = getHeatmapColor(dollars);
                let circleBorder: string | undefined;
                let circleSize   = CELL_SIZE - 4;
                if (!dollars)   { circleBorder = LIME_GREEN; }
                if (isToday)    { circleBg = 'transparent'; circleBorder = LIME_GREEN; /* size set below */ }
                if (isSelected) { circleBg = 'rgba(205,245,69,0.18)'; circleBorder = LIME_GREEN; }

                // Sun geometry — smaller circle so rays have room to breathe
                const TODAY_R   = Math.round((CELL_SIZE - 4) * 0.52);
                const RAY_LEN   = 7;
                const RAY_GAP   = 4;
                const rayRadius = TODAY_R / 2 + RAY_GAP + RAY_LEN / 2;
                const cx = CELL_SIZE / 2;
                const cy = CELL_SIZE / 2;

                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.dayCell}
                    onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                    activeOpacity={0.7}
                  >
                    {/* Sun rays — only for today */}
                    {isToday && Array.from({ length: 8 }, (_, i) => {
                      const rad = (i * 45 * Math.PI) / 180;
                      const mx  = cx + rayRadius * Math.cos(rad);
                      const my  = cy + rayRadius * Math.sin(rad);
                      return (
                        <View
                          key={i}
                          style={{
                            position: 'absolute',
                            width: RAY_LEN,
                            height: 2.5,
                            borderRadius: 1.5,
                            backgroundColor: LIME_GREEN,
                            left: mx - RAY_LEN / 2,
                            top:  my - 1.25,
                            transform: [{ rotate: `${i * 45}deg` }],
                          }}
                        />
                      );
                    })}
                    {/* Heatmap circle — uniform size (smaller for today) */}
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: circleBg,
                          borderWidth:  circleBorder ? 1.5 : 0,
                          borderColor:  circleBorder ?? 'transparent',
                          width:        isToday ? TODAY_R : circleSize,
                          height:       isToday ? TODAY_R : circleSize,
                          borderRadius: isToday ? TODAY_R / 2 : circleSize / 2,
                        },
                      ]}
                    />
                    {/* Day number always visible, centered over the circle */}
                    <Text style={[
                      styles.dayNumber,
                      isSelected && styles.selectedNumber,
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Less</Text>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <View
                key={v}
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: getHeatmapColor(v),
                    borderWidth: v === 0 ? 1.5 : 0,
                    borderColor: v === 0 ? LIME_GREEN : 'transparent',
                  },
                ]}
              />
            ))}
            <Text style={styles.legendLabel}>More</Text>
          </View>

        </View>
      </GestureDetector>

      {/* ── Day events panel ── */}
      {selectedDate && (
        <View style={styles.eventsPanel}>
          <View style={styles.eventsPanelHeader}>
            <View>
              <Text style={styles.eventsPanelTitle}>
                {selectedDay
                  ? `${DAY_NAMES[selectedDay.getDay()]}, ${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getDate()}`
                  : ''}
              </Text>
              {selectedDate && predictedTotalsByDate[selectedDate] > 0 && (
                <Text style={styles.dayTotalText}>
                  Est. total: ${predictedTotalsByDate[selectedDate].toFixed(2)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setSelectedDate(null)} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {selectedCheckIns.length === 0 && selectedEvents.length === 0 ? (
            <Text style={styles.noEventsText}>No events</Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── Check-ins ── */}
              {selectedCheckIns.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Check-ins</Text>
                  {selectedCheckIns.map((r, i) => (
                    <View key={`checkin-${i}`}>
                      <View style={styles.eventRow}>
                        <View style={styles.eventTimePart}>
                          <Text style={styles.checkInAmount}>
                            ${r.amount ?? 0}
                          </Text>
                        </View>
                        <View style={[styles.eventDot, styles.checkInDot]} />
                        <Text style={styles.eventTitle} numberOfLines={1}>{r.location}</Text>
                      </View>
                      {i < selectedCheckIns.length - 1 && <View style={styles.eventDivider} />}
                    </View>
                  ))}
                </>
              )}

              {/* ── Calendar events ── */}
              {selectedEvents.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, selectedCheckIns.length > 0 && { marginTop: 14 }]}>
                    Events
                  </Text>
                  {selectedEvents.map((item, i) => {
                    const pred = selectedDate
                      ? predictedByEventKey[`${selectedDate}|${norm(item.title)}`]
                      : undefined;
                    return (
                      <View key={item.id}>
                        <View style={styles.eventRow}>
                          <View style={styles.eventTimePart}>
                            {item.isAllDay ? (
                              <Text style={styles.allDayBadge}>All day</Text>
                            ) : (
                              <>
                                <Text style={styles.eventTime}>
                                  {item.startTime ? formatTime(item.startTime) : '—'}
                                </Text>
                                {item.endTime && (
                                  <Text style={styles.eventTimeEnd}>
                                    {formatTime(item.endTime)}
                                  </Text>
                                )}
                              </>
                            )}
                          </View>
                          <View style={styles.eventDot} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                            {pred && pred.amount > 0 && (
                              <Text style={styles.eventEstimate}>
                                ${pred.amount.toFixed(2)} · {pred.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        {i < selectedEvents.length - 1 && <View style={styles.eventDivider} />}
                      </View>
                    );
                  })}
                </>
              )}

            </ScrollView>
          )}
        </View>
      )}

    </View>
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
});
