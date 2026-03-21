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
import { useAuth } from '../../context/AuthContext';

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
const DARK_GREEN = '#0a542f';
const MINT       = '#d2f3e2';
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string | null; // ISO datetime string, null = all-day
  endTime:   string | null;
  isAllDay:  boolean;
}

function getHeatmapColor(count: number): string {
  if (!count) return MINT;
  const t = Math.min(count, 5) / 5;
  const r = Math.round(210 - t * (210 - 10));
  const g = Math.round(243 - t * (243 - 84));
  const b = Math.round(226 - t * (226 - 47));
  return `rgb(${r}, ${g}, ${b})`;
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
  const { token, checkInResults } = useAuth();

  const [monthOffset, setMonthOffset]       = useState(0);
  const [eventCounts, setEventCounts]       = useState<{ [dateStr: string]: number }>({});
  const [eventsByDate, setEventsByDate]     = useState<{ [dateStr: string]: CalendarEvent[] }>({});
  const [fetchedMonths, setFetchedMonths]   = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);

  const today       = new Date();
  const displayDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year        = displayDate.getFullYear();
  const month       = displayDate.getMonth();

  // ── Fetch events for the displayed month ──────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const key = `${year}-${month}`;
    if (fetchedMonths.has(key)) return;

    const fetchEvents = async () => {
      try {
        const start = new Date(year, month, 1);
        const end   = new Date(year, month + 1, 0, 23, 59, 59);
        const res   = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
          `?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}` +
          `&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (!res.ok) return;

        const counts: { [dateStr: string]: number }           = {};
        const byDate: { [dateStr: string]: CalendarEvent[] }  = {};

        (data.items || []).forEach((event: any) => {
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

          counts[dateStr] = (counts[dateStr] || 0) + 1;
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr].push({
            id:        event.id ?? `${dateStr}-${Math.random()}`,
            title:     event.summary ?? '(No title)',
            startTime,
            endTime,
            isAllDay,
          });
        });

        setEventCounts(prev => ({ ...prev, ...counts }));
        setEventsByDate(prev => ({ ...prev, ...byDate }));
        setFetchedMonths(prev => new Set([...prev, key]));
      } catch (_) {}
    };

    fetchEvents();
  }, [token, year, month]);

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
                const count   = eventCounts[dateStr] || 0;
                const isToday =
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                const isSelected = selectedDate === dateStr;

                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.dayCell}
                    onPress={() => setSelectedDate(isSelected ? null : dateStr)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        { backgroundColor: getHeatmapColor(count) },
                        isToday    && styles.todayRing,
                        isSelected && styles.selectedRing,
                      ]}
                    >
                      <Text style={[
                        styles.dayNumber,
                        isToday    && styles.todayNumber,
                        isSelected && styles.selectedNumber,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Less</Text>
            {[0, 1, 2, 3, 4, 5].map(v => (
              <View key={v} style={[styles.legendDot, { backgroundColor: getHeatmapColor(v) }]} />
            ))}
            <Text style={styles.legendLabel}>More</Text>
          </View>

        </View>
      </GestureDetector>

      {/* ── Day events panel ── */}
      {selectedDate && (
        <View style={styles.eventsPanel}>
          <View style={styles.eventsPanelHeader}>
            <Text style={styles.eventsPanelTitle}>
              {selectedDay
                ? `${DAY_NAMES[selectedDay.getDay()]}, ${MONTH_NAMES[selectedDay.getMonth()]} ${selectedDay.getDate()}`
                : ''}
            </Text>
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
                  {selectedEvents.map((item, i) => (
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
                        <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                      </View>
                      {i < selectedEvents.length - 1 && <View style={styles.eventDivider} />}
                    </View>
                  ))}
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
    color: DARK_GREEN,
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
    color: DARK_GREEN,
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
  dayCell: { width: CELL_SIZE, alignItems: 'center' },
  dayCircle: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    borderRadius: (CELL_SIZE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: {
    borderWidth: 2,
    borderColor: DARK_GREEN,
  },
  selectedRing: {
    borderWidth: 2,
    borderColor: DARK_GREEN,
    backgroundColor: DARK_GREEN,
  },
  dayNumber: { fontSize: 11, color: '#1e1d19' },
  todayNumber: { fontWeight: '700', color: DARK_GREEN },
  selectedNumber: { fontWeight: '700', color: '#fff' },

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
    color: DARK_GREEN,
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
    color: DARK_GREEN,
  },
  checkInDot: {
    backgroundColor: MINT,
    borderWidth: 1.5,
    borderColor: DARK_GREEN,
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
    color: DARK_GREEN,
  },
  eventTimeEnd: {
    fontSize: 10,
    color: '#8e8e93',
    marginTop: 1,
  },
  allDayBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: DARK_GREEN,
    backgroundColor: MINT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: DARK_GREEN,
  },
  eventTitle: {
    flex: 1,
    fontSize: 13,
    color: '#1e1d19',
  },
  eventDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f0f0',
  },
});
