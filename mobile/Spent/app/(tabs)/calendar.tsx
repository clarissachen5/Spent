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
  Food:           '#e4f3ff',
  Shopping:       '#fff1d6',
  Coffee:         '#fde4ec',
  Entertainment:  '#ece0f8',
  Transportation: '#ffe7d4',
  Other:          '#fde0e0',
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

// Normalize event titles so minor differences (case, whitespace) don't break matching
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function CalendarScreen() {
  const { top }   = useSafeAreaInsets();
  const { token, userId, checkInResults, predictions, predictionsLoaded } = useAuth();

  const [monthOffset, setMonthOffset]       = useState(0);
  const [eventsByDate, setEventsByDate]     = useState<{ [dateStr: string]: CalendarEvent[] }>({});
  const [fetchedMonths, setFetchedMonths]   = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [graphRowWidth, setGraphRowWidth]   = useState(0);

  // Build lookup maps from Ollama predictions
  const predictedTotalsByDate: { [date: string]: number } = {};
  const predictedByEventKey: { [key: string]: { amount: number; description: string } } = {};
  predictions.forEach((p: SpendingEstimate) => {
    predictedTotalsByDate[p.date] = (predictedTotalsByDate[p.date] || 0) + Number(p.medium?.amount ?? 0);
    predictedByEventKey[`${p.date}|${norm(p.event)}`] = {
      amount: Number(p.medium?.amount ?? 0),
      description: p.medium?.description ?? '',
    };
  });

  const today       = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year        = displayDate.getFullYear();
  const month       = displayDate.getMonth();

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
      console.log('[Calendar] loaded', items.length, 'events for', key);
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

  // ── Normalization caps across the whole month ────────────────────────────
  let monthMaxEvents   = 1;
  let monthMaxSpending = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateStr(year, month, d);
    monthMaxEvents   = Math.max(monthMaxEvents,   (eventsByDate[ds]?.length ?? 0));
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
            const eventsArr   = row.map(d => d ? (eventsByDate[toDateStr(year, month, d)]?.length ?? 0) : 0);
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
                  maxEvents={monthMaxEvents}
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
            return (
              <View key={`checkin-${i}`} style={[styles.checkInPill, { backgroundColor: bg }]}>
                <Text style={styles.checkInName} numberOfLines={1}>{r.location}</Text>
                <Text style={styles.checkInAmountNew}>${r.amount ?? 0}</Text>
                <View style={styles.editDot}>
                  <Text style={styles.editDotText}>✎</Text>
                </View>
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
});
