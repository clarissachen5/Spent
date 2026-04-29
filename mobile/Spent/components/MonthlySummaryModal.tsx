import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../constants/config';

const DARK_GREEN = '#0a542f';
const BLACK      = '#1e1d19';
const GRAY_TEXT  = '#a5a5a5';

// Pastel colors keyed to each spending category
const CATEGORY_COLORS: Record<string, string> = {
  Food:           '#C8E8FF', // light sky blue pastel
  Shopping:       '#fcb842', // yellow-orange
  Coffee:         '#F4B8C8', // light pink pastel
  Entertainment:  '#C9A8E8', // pastel purple
  Transportation: '#FFCBA4', // pastel peach
  Other:          '#F4A0A0', // pastel red
};

// Fallback palette for custom categories
const FALLBACK_COLORS = [
  '#F4A0A0', // pastel red
  '#A0C4F4', // pastel blue
  '#A0F4B8', // pastel mint
  '#F4D0A0', // pastel peach
  '#D0A0F4', // pastel lavender
  '#A0F4F4', // pastel cyan
];

function categoryColor(name: string, fallbackIndex: number): string {
  return CATEGORY_COLORS[name] ?? FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Donut slice: arc on outer ring, line to inner ring, arc back
function buildDonutSlicePath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
) {
  const sweep   = Math.min(endAngle - startAngle, 359.99);
  const end     = startAngle + sweep;
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

export default function MonthlySummaryModal({ visible, onClose }: Props) {
  const { checkInResults } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const [summary, setSummary]               = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const monthLabel = useMemo(
    () => new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    [],
  );

  // Filter to this month's check-ins that have an amount
  const categoryData = useMemo(() => {
    const now   = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();

    const totals: Record<string, number> = {};
    checkInResults.forEach(ci => {
      if (!ci.amount || !ci.visited) return;
      const d = new Date(ci.timestamp);
      if (d.getMonth() !== month || d.getFullYear() !== year) return;
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
  }, [checkInResults]);

  const total = useMemo(
    () => categoryData.reduce((s, d) => s + d.amount, 0),
    [categoryData],
  );

  // Donut chart dimensions
  const SIZE   = 220;
  const cx     = SIZE / 2;
  const cy     = SIZE / 2;
  const outerR = SIZE / 2 - 8;
  const innerR = outerR * 0.58; // thickness of the ring

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

  // Fetch AI summary whenever modal opens with data
  useEffect(() => {
    if (!visible || categoryData.length === 0) return;
    setLoadingSummary(true);
    setSummary('');

    const byCategory = Object.fromEntries(categoryData.map(d => [d.category, d.amount]));

    fetch(`${API_BASE_URL}/ollama/spending-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spending_by_category: byCategory, total, month: monthLabel }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Backend error ${r.status}`);
        return r.json();
      })
      .then(data => setSummary(data.summary || 'No summary returned.'))
      .catch(() => setSummary('Could not load AI summary — make sure the backend and Ollama are running.'))
      .finally(() => setLoadingSummary(false));
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>This Month's Summary</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.monthLabel}>{monthLabel}</Text>

        {categoryData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No spending recorded this month yet.</Text>
            <Text style={styles.emptyHint}>Check in at locations to start tracking.</Text>
          </View>
        ) : (
          <>
            {/* Donut chart with total in center */}
            <View style={styles.chartWrap}>
              <Svg width={SIZE} height={SIZE}>
                {slices.map((slice, i) => (
                  <Path key={i} d={slice.path} fill={slice.color} />
                ))}
              </Svg>
              {/* Center label */}
              <View style={[styles.chartCenter, { width: innerR * 2, height: innerR * 2, borderRadius: innerR }]}>
                <Text style={styles.centerLabel}>Total</Text>
                <Text style={styles.centerAmount}>${total.toFixed(0)}</Text>
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {categoryData.map((d, i) => (
                <View key={i} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                  <Text style={styles.legendCat}>{d.category}</Text>
                  <Text style={styles.legendAmt}>${d.amount.toFixed(2)}</Text>
                  <Text style={styles.legendPct}>
                    {((d.amount / total) * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>

            {/* AI Summary */}
            <View style={styles.divider} />
            <Text style={styles.aiLabel}>AI Insights</Text>
            {loadingSummary ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={DARK_GREEN} size="small" />
                <Text style={styles.loadingText}>Generating your summary…</Text>
              </View>
            ) : (
              <Text style={styles.summaryText}>{summary}</Text>
            )}
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK_GREEN,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    color: BLACK,
  },
  monthLabel: {
    fontSize: 13,
    color: GRAY_TEXT,
    marginBottom: 24,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  centerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  centerAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: DARK_GREEN,
  },
  legend: {
    gap: 12,
    marginBottom: 28,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendCat: {
    flex: 1,
    fontSize: 14,
    color: BLACK,
    fontWeight: '500',
  },
  legendAmt: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK_GREEN,
  },
  legendPct: {
    fontSize: 12,
    color: GRAY_TEXT,
    width: 36,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 24,
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: GRAY_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: GRAY_TEXT,
  },
  summaryText: {
    fontSize: 15,
    color: BLACK,
    lineHeight: 23,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: BLACK,
  },
  emptyHint: {
    fontSize: 13,
    color: GRAY_TEXT,
  },
});
