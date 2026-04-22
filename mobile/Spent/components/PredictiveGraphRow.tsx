import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';

const OUTLINE_GREEN = '#4a7a1e';
const FILL_GREEN    = '#cdf545';
const RED_DASH      = '#e94e77';
const SELECT_GREEN  = '#2f7a22';

export interface PredictiveGraphRowProps {
  width: number;
  height?: number;
  events: number[];      // length 7 (use 0 for blank cells)
  spending: number[];    // length 7
  maxEvents: number;     // normalization cap (shared across rows for calendar)
  maxSpending: number;
  blanks?: boolean[];    // length 7, true = don't draw data for this day (empty cell)
  dayNumbers?: (number | null)[];   // shown under each column
  selectedIndex?: number;            // index 0-6 for the selected column (calendar)
  onDayPress?: (index: number) => void;
  showDayLabels?: boolean;           // Sun/Mon row above (home only)
  dayLabels?: string[];
}

// Smooth Bezier curve through given points
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const dx = (p1.x - p0.x) * 0.4;
    d += ` C ${p0.x + dx} ${p0.y}, ${p1.x - dx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function PredictiveGraphRow({
  width,
  height = 72,
  events,
  spending,
  maxEvents,
  maxSpending,
  blanks,
  dayNumbers,
  selectedIndex,
  onDayPress,
  showDayLabels,
  dayLabels,
}: PredictiveGraphRowProps) {
  const finite = (n: number) => (Number.isFinite(n) ? n : 0);
  const safeMaxE = Math.max(1, finite(maxEvents));
  const safeMaxS = Math.max(1, finite(maxSpending));

  const topPad    = 6;
  const bottomPad = 4;
  const safeHeight = Math.max(1, finite(height));
  const safeWidth  = Math.max(1, finite(width));
  const amp       = Math.max(1, safeHeight - topPad - bottomPad);
  const baseline  = safeHeight - bottomPad;
  const stepX     = safeWidth / 7;

  // Only include non-blank cells as data points; skip blanks so curves don't dip into empty days
  const eventPts = events
    .map((raw, i) => {
      const v = finite(raw);
      return {
        x: (i + 0.5) * stepX,
        y: baseline - (v / safeMaxE) * amp,
        i,
        blank: blanks?.[i] ?? false,
      };
    })
    .filter(p => !p.blank);

  const spendPts = spending
    .map((raw, i) => {
      const v = finite(raw);
      return {
        x: (i + 0.5) * stepX,
        y: baseline - (v / safeMaxS) * amp,
        i,
        blank: blanks?.[i] ?? false,
      };
    })
    .filter(p => !p.blank);

  const eventLine = smoothPath(eventPts);
  const eventArea = eventPts.length >= 2
    ? `${eventLine} L ${eventPts[eventPts.length - 1].x} ${baseline} L ${eventPts[0].x} ${baseline} Z`
    : '';
  const spendLine = smoothPath(spendPts);

  // Selected day marker
  const selectedX =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < 7
      ? (selectedIndex + 0.5) * stepX
      : null;
  const selectedEventY =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < 7
      ? baseline - (finite(events[selectedIndex]) / safeMaxE) * amp
      : null;

  return (
    <View style={{ width }}>
      {showDayLabels && dayLabels && (
        <View style={styles.labelRow}>
          {dayLabels.map((l, i) => (
            <Text key={i} style={[styles.dayLabel, { width: stepX }]}>{l}</Text>
          ))}
        </View>
      )}

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={FILL_GREEN} stopOpacity={0.85} />
            <Stop offset="1" stopColor={FILL_GREEN} stopOpacity={0.08} />
          </LinearGradient>
        </Defs>

        {eventArea.length > 0 && <Path d={eventArea} fill="url(#greenFill)" />}
        {eventLine.length > 0 && (
          <Path
            d={eventLine}
            stroke={OUTLINE_GREEN}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {spendLine.length > 0 && (
          <Path
            d={spendLine}
            stroke={RED_DASH}
            strokeWidth={1.3}
            strokeDasharray="3,3"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {selectedX != null && selectedEventY != null && (
          <>
            <Line
              x1={selectedX}
              y1={selectedEventY}
              x2={selectedX}
              y2={baseline}
              stroke={SELECT_GREEN}
              strokeWidth={1.2}
            />
            <Circle cx={selectedX} cy={selectedEventY} r={4} fill={SELECT_GREEN} />
          </>
        )}
      </Svg>

      {dayNumbers && (
        <View style={styles.numberRow}>
          {dayNumbers.map((n, i) => {
            const active = selectedIndex === i;
            const content = (
              <Text
                style={[
                  styles.dayNumber,
                  active && styles.dayNumberActive,
                ]}
              >
                {n ?? ''}
              </Text>
            );
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={n == null ? 1 : 0.6}
                style={{ width: stepX, alignItems: 'center' }}
                onPress={() => n != null && onDayPress?.(i)}
                disabled={n == null || !onDayPress}
              >
                {content}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#8e8e93',
    fontWeight: '500',
  },
  numberRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  dayNumber: {
    fontSize: 11,
    color: '#6b6b6b',
  },
  dayNumberActive: {
    color: SELECT_GREEN,
    fontWeight: '700',
  },
});
