import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const heroLandscape = require('../../assets/icons/heroLandscape.svg');

// ── Design tokens (Figma) ────────────────────────────────────────────────────
const PAGE_BG      = '#f4f5f5';
const CARD_BG      = '#ffffff';
const DARK_GREEN   = '#0a542f';
const LIME_GREEN   = '#cdf545';
const BLACK        = '#1e1d19';
const GRAY_TITLE   = '#c9cbcb';
const GRAY_TEXT    = '#a5a5a5';
const PILL_GRAY    = '#e7e9e9';

// Pastel palette mirrored from MonthlySummaryModal so the donut matches
const CATEGORY_COLORS: Record<string, string> = {
  Food:           '#9ED3F0',
  Shopping:       '#fcb842',
  Coffee:         '#F4B8C8',
  Entertainment:  '#C9A8E8',
  Transportation: '#FFCBA4',
  Other:          '#F4A0A0',
};
const FALLBACK_COLORS = ['#F4A0A0', '#A0C4F4', '#A0F4B8', '#F4D0A0', '#D0A0F4', '#A0F4F4'];

// Pastel bg for the amount pills in the legend
const CATEGORY_PILL_BG: Record<string, string> = {
  Food:           '#e4f3ff',
  Shopping:       '#fff1d6',
  Coffee:         '#fde4ec',
  Entertainment:  '#ece0f8',
  Transportation: '#ffe7d4',
  Other:          '#fde0e0',
};

// Local SVG icons that ship with the app
const foodIcon           = require('../../assets/icons/foodIcon.svg');
const coffeeIcon         = require('../../assets/icons/coffeeIcon.svg');
const entertainmentIcon  = require('../../assets/icons/entertainmentIcon.svg');
const transportationIcon = require('../../assets/icons/transportationIcon.svg');
const shoppingIcon       = require('../../assets/icons/shoppingIcon.svg');
const otherIcon          = require('../../assets/icons/otherIcon.svg');
const CATEGORY_ICON: Record<string, any> = {
  Food: foodIcon,
  Coffee: coffeeIcon,
  Entertainment: entertainmentIcon,
  Transportation: transportationIcon,
  Shopping: shoppingIcon,
  Other: otherIcon,
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function categoryColor(name: string, fallbackIndex: number): string {
  return CATEGORY_COLORS[name] ?? FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildDonutSlicePath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
) {
  const sweep    = Math.min(endAngle - startAngle, 359.99);
  const end      = startAngle + sweep;
  const largeArc = sweep > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd   = polarToCartesian(cx, cy, outerR, end);
  const innerEnd   = polarToCartesian(cx, cy, innerR, end);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function spenderType(total: number, goals: string[]): string {
  if (total === 0) return 'New Spender';
  if (total < 500) return 'Conscious Spender';
  if (total < 1500) return 'Balanced Spender';
  if (total < 3000) return 'Generous Spender';
  return 'Big Spender';
}

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const { checkInResults, userProfile } = useAuth();

  // Month selector — defaults to current month, cycles only months that have data or allows all
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear]   = useState<number>(now.getFullYear());
  const [pickerOpen, setPickerOpen]       = useState(false);

  const monthLabel = MONTH_NAMES[selectedMonth];
  const monthShort = monthLabel; // full name used per Figma

  // Build the list of months present in the data (plus current month even if empty)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(`${now.getFullYear()}-${now.getMonth()}`);
    checkInResults.forEach(ci => {
      const d = new Date(ci.timestamp);
      set.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    return Array.from(set)
      .map(k => {
        const [y, m] = k.split('-').map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [checkInResults]);

  // Filter check-ins for the selected month
  const monthCheckIns = useMemo(() => {
    return checkInResults.filter(ci => {
      if (!ci.visited) return false;
      const d = new Date(ci.timestamp);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [checkInResults, selectedMonth, selectedYear]);

  // Totals by category (amount-weighted) for the donut + legend
  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {};
    monthCheckIns.forEach(ci => {
      if (!ci.amount) return;
      const cat = ci.category || 'Other';
      totals[cat] = (totals[cat] || 0) + ci.amount;
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], i) => ({
        category,
        amount,
        color: categoryColor(category, i),
      }));
  }, [monthCheckIns]);

  const total = useMemo(
    () => categoryData.reduce((s, d) => s + d.amount, 0),
    [categoryData],
  );

  // Counts by category (for "Most Entries Category")
  const entriesByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    monthCheckIns.forEach(ci => {
      const cat = ci.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [monthCheckIns]);

  // Location frequency + spend, plus a per-location dominant category for icon lookup
  const locationStats = useMemo(() => {
    const counts:   Record<string, number> = {};
    const sums:     Record<string, number> = {};
    const catByLoc: Record<string, Record<string, number>> = {};
    monthCheckIns.forEach(ci => {
      const loc = ci.location || 'Unknown';
      const cat = ci.category || 'Other';
      counts[loc] = (counts[loc] || 0) + 1;
      sums[loc]   = (sums[loc] || 0) + (ci.amount || 0);
      catByLoc[loc] = catByLoc[loc] || {};
      catByLoc[loc][cat] = (catByLoc[loc][cat] || 0) + 1;
    });
    const dominantCategory = (loc: string): string | null => {
      const cats = catByLoc[loc];
      if (!cats) return null;
      return Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const byCount = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const bySum   = Object.entries(sums).sort((a, b) => b[1] - a[1]);
    return {
      mostFrequent:        byCount[0]?.[0] ?? null,
      mostFrequentCat:     byCount[0] ? dominantCategory(byCount[0][0]) : null,
      topSpend:            bySum[0]?.[0] ?? null,
      topSpendCat:         bySum[0] ? dominantCategory(bySum[0][0]) : null,
      topSpendAmt:         bySum[0]?.[1] ?? 0,
    };
  }, [monthCheckIns]);

  // Donut dimensions
  const SIZE   = 220;
  const cx     = SIZE / 2;
  const cy     = SIZE / 2;
  const outerR = SIZE / 2 - 8;
  const innerR = outerR * 0.82;

  const slices = useMemo(() => {
    if (total === 0) return [];
    let cursor = 0;
    return categoryData.map(d => {
      const sweep = (d.amount / total) * 360;
      const path  = buildDonutSlicePath(cx, cy, outerR, innerR, cursor, cursor + sweep);
      cursor += sweep;
      return { ...d, path };
    });
  }, [categoryData, total]);

  const spender = spenderType(total, userProfile?.goals ?? []);

  const mostSpentCategory  = categoryData[0]?.category ?? null;
  const mostEntriesCat     = entriesByCategory[0]?.[0] ?? null;
  const mostFrequentedLoc  = locationStats.mostFrequent;
  const locationToAvoid    = locationStats.topSpend;

  const displayName = userProfile?.school?.split(' ')[0] || 'Hello';

  const tiles: {
    label: string;
    value: string | null;
    iconCategory: string | null;
  }[] = [
    { label: 'MOST SPENT CATEGORY',     value: mostSpentCategory,    iconCategory: mostSpentCategory },
    { label: 'LOCATION TO AVOID',       value: locationToAvoid,      iconCategory: locationStats.topSpendCat },
    { label: 'MOST ENTRIES CATEGORY',   value: mostEntriesCat,       iconCategory: mostEntriesCat },
    { label: 'MOST FREQUENTED LOCATION',value: mostFrequentedLoc,    iconCategory: locationStats.mostFrequentCat },
  ];

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Summary</Text>

        {/* ── Donut card with landscape backdrop ───────── */}
        <View style={styles.donutCard}>
          <View style={styles.donutCardContent}>
            <TouchableOpacity
              style={styles.monthPill}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.monthPillText}>
                {monthLabel.toUpperCase()} SPENDING
              </Text>
              <Text style={styles.monthPillChevron}>▾</Text>
            </TouchableOpacity>

            <View style={styles.chartWrap}>
              {total === 0 ? (
                <View style={[styles.donutEmpty, { width: SIZE, height: SIZE }]}>
                  <Text style={styles.emptyTitle}>No spending yet</Text>
                  <Text style={styles.emptyHint}>for {monthLabel} {selectedYear}</Text>
                </View>
              ) : (
                <>
                  <Svg width={SIZE} height={SIZE}>
                    {slices.map((slice, i) => (
                      <Path key={i} d={slice.path} fill={slice.color} />
                    ))}
                  </Svg>
                  <View
                    style={[
                      styles.chartCenter,
                      { width: innerR * 2, height: innerR * 2, borderRadius: innerR },
                    ]}
                  >
                    <Text style={styles.centerAmount}>${total.toFixed(0)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          <Image
            source={heroLandscape}
            style={styles.landscape}
            contentFit="cover"
          />
        </View>

        {/* ── Info card: name + spender + 2x2 stat tiles ── */}
        <View style={styles.infoCard}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{displayName}</Text>
            <View style={styles.editDot}>
              <Text style={styles.editDotText}>✎</Text>
            </View>
          </View>
          <Text style={styles.spenderLine}>
            in {monthLabel} you were a <Text style={styles.spenderBold}>{spender}</Text>
          </Text>

          <View style={styles.tileGrid}>
            {tiles.map((t, i) => {
              const cat = t.iconCategory;
              const icon = cat ? CATEGORY_ICON[cat] : null;
              const bg   = cat ? CATEGORY_PILL_BG[cat] ?? PILL_GRAY : PILL_GRAY;
              return (
                <View key={i} style={styles.tile}>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                  <View style={[styles.tilePill, { backgroundColor: bg }]}>
                    {icon && (
                      <Image source={icon} style={styles.tileIcon} contentFit="contain" />
                    )}
                    <Text style={styles.tileValue} numberOfLines={1}>
                      {t.value ?? '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Month picker modal ─────────────────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Select Month</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableMonths.map(({ year, month }) => {
                const active = year === selectedYear && month === selectedMonth;
                return (
                  <TouchableOpacity
                    key={`${year}-${month}`}
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => {
                      setSelectedMonth(month);
                      setSelectedYear(year);
                      setPickerOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>
                      {MONTH_NAMES[month]} {year}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: GRAY_TITLE,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── Donut card with landscape backdrop ────────────────────────────────
  donutCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 16,
  },
  donutCardContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  monthPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: DARK_GREEN,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: CARD_BG,
  },
  monthPillText: {
    fontSize: 11,
    color: DARK_GREEN,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  monthPillChevron: {
    fontSize: 10,
    color: DARK_GREEN,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  centerAmount: {
    fontSize: 30,
    fontWeight: '600',
    color: DARK_GREEN,
    letterSpacing: -0.5,
  },
  donutEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 200,
    borderWidth: 14,
    borderColor: '#eaf1ee',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK_GREEN,
  },
  emptyHint: {
    fontSize: 12,
    color: GRAY_TEXT,
    marginTop: 4,
  },
  landscape: {
    width: '100%',
    height: 90,
    marginTop: -28,
  },

  // ── Info card ─────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: BLACK,
  },
  editDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f4f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDotText: {
    fontSize: 10,
    color: GRAY_TEXT,
  },
  spenderLine: {
    fontSize: 12,
    color: GRAY_TEXT,
    marginTop: 4,
    marginBottom: 16,
  },
  spenderBold: {
    fontWeight: '700',
    color: BLACK,
  },

  // ── Stat tiles (2x2) ──────────────────────────────────────────────────
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: GRAY_TEXT,
    letterSpacing: 0.5,
  },
  tilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  tileIcon: {
    width: 18,
    height: 18,
  },
  tileValue: {
    fontSize: 12,
    fontWeight: '600',
    color: BLACK,
    flexShrink: 1,
  },

  // Picker
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK_GREEN,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  pickerRow: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pickerRowActive: {
    backgroundColor: DARK_GREEN,
  },
  pickerRowText: {
    fontSize: 15,
    color: BLACK,
  },
  pickerRowTextActive: {
    color: LIME_GREEN,
    fontWeight: '700',
  },
});
