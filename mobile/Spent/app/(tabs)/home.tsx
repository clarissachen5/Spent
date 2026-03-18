import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';

// ── Figma assets ─────────────────────────────────────────────────────────────
const chevronLeft       = 'https://www.figma.com/api/mcp/asset/29d4cd83-5769-4622-827d-488bc94d03b3';
const chevronRight      = 'https://www.figma.com/api/mcp/asset/dc5486d9-29b7-4a71-ba7f-c892a19bf46a';
const dollarSignLarge   = 'https://www.figma.com/api/mcp/asset/0f6e0447-a97d-4bfd-95c1-f1becf9134fc';
const clipboardIcon     = 'https://www.figma.com/api/mcp/asset/ac495e4e-612e-4910-b34f-1271c52cd1cb';
const flameIcon         = 'https://www.figma.com/api/mcp/asset/afe96631-c180-4067-87e5-f8a4cc8a92ec';
const heroLandscape     = 'https://www.figma.com/api/mcp/asset/478154a9-f4bd-4c5d-9558-4b2db077bf28';
const bagIcon           = 'https://www.figma.com/api/mcp/asset/b2bfba23-da0e-4ca0-b85d-601389f7f890';
const seeMoreArrow      = 'https://www.figma.com/api/mcp/asset/64462d58-b07c-415f-8ce1-b4d0777a565a';
const foodIcon          = 'https://www.figma.com/api/mcp/asset/237e30c9-0fa4-4418-b406-1ea25bc1f65a';
const budgetMarkerLine  = 'https://www.figma.com/api/mcp/asset/8fb89c31-d63b-4909-aa8a-e78c8c9c9db4';
const dollarSignSmall   = 'https://www.figma.com/api/mcp/asset/6b630cd4-2d61-4f88-8178-a3f0f0e7e5cd';
const shoppingIcon      = 'https://www.figma.com/api/mcp/asset/8631324c-4776-4ce3-b4df-118d4b2e2e28';
const coffeeIcon        = 'https://www.figma.com/api/mcp/asset/20435e45-b93b-4f06-85e7-6f7491f5f8a4';
const entertainmentIcon = 'https://www.figma.com/api/mcp/asset/cd3982e4-f59d-40ab-91fc-b4522b987210';
const transportationIcon= 'https://www.figma.com/api/mcp/asset/02b80772-e0ac-4cea-88fc-5bc45370f2ea';
const otherIcon         = 'https://www.figma.com/api/mcp/asset/13e7cb32-89dc-4402-a5e6-4cb0ddc8a7c5';
const calendarIcon      = 'https://www.figma.com/api/mcp/asset/104a3826-9173-4913-9a42-db8787ca07a3';
// ─────────────────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];

const CATEGORIES = [
  { name: 'Food',           icon: foodIcon,           amount: 11, fill: 0.62 },
  { name: 'Shopping',       icon: shoppingIcon,       amount: 11, fill: 0.62 },
  { name: 'Coffee',         icon: coffeeIcon,         amount: 11, fill: 0.62 },
  { name: 'Entertainment',  icon: entertainmentIcon,  amount: 11, fill: 0.62 },
  { name: 'Transportation', icon: transportationIcon, amount: 11, fill: 0.62 },
  { name: 'Other',          icon: otherIcon,          amount: 11, fill: 0.62 },
];

function getWeekDates(): number[] {
  const curr = new Date();
  const dayOfWeek = curr.getDay(); // 0 = Sun
  const monday = new Date(curr);
  monday.setDate(curr.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}

export default function HomeScreen() {
  const { token } = useLocalSearchParams();
  const weekDates = getWeekDates();
  const totalSaved = 362;
  const streak = 3;
  const [weekOffset, setWeekOffset] = useState(0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Week navigation ── */}
      <View style={styles.weekSection}>
        {/* Today pill */}
        <View style={styles.todayPill}>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset - 1)}>
            <Image source={{ uri: chevronLeft }} style={styles.chevronImg} contentFit="contain" />
          </TouchableOpacity>
          <Text style={styles.todayLabel}>Today</Text>
          <TouchableOpacity onPress={() => setWeekOffset(weekOffset + 1)}>
            <Image source={{ uri: chevronRight }} style={styles.chevronImg} contentFit="contain" />
          </TouchableOpacity>
        </View>

        {/* Day cards */}
        <View style={styles.weekRow}>
          {WEEK_DAYS.map((day, i) => (
            <View key={day} style={styles.dayCard}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={styles.dayCircle}>
                <Text style={styles.dayNumber}>{weekDates[i]}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── Hero card ── */}
      <View style={styles.heroCard}>
        {/* Content row */}
        <View style={styles.heroContent}>
          {/* Savings amount */}
          <View style={styles.savingsGroup}>
            <View style={styles.savingsAmountRow}>
              <Image source={{ uri: dollarSignLarge }} style={styles.dollarLarge} contentFit="contain" />
              <Text style={styles.savedAmount}>{totalSaved}</Text>
            </View>
            <Text style={styles.savedLabel}>saved with Spent</Text>
          </View>

          {/* Check-in button + streak badge */}
          <View style={styles.checkInWrapper}>
            <TouchableOpacity
              style={styles.checkInButton}
              onPress={() =>
                router.push({ pathname: '/checkin', params: { token } })
              }
            >
              <Image source={{ uri: clipboardIcon }} style={styles.clipboardImg} contentFit="contain" />
              <Text style={styles.checkInLabel}>check in</Text>
            </TouchableOpacity>

            <View style={styles.streakBadge}>
              <Image source={{ uri: flameIcon }} style={styles.flameImg} contentFit="contain" />
              <Text style={styles.streakCount}>{streak}</Text>
            </View>
          </View>
        </View>

        {/* Landscape illustration */}
        <Image
          source={{ uri: heroLandscape }}
          style={styles.landscapeImg}
          contentFit="cover"
        />
      </View>

      {/* ── Your Spending header ── */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleGroup}>
          <Image source={{ uri: bagIcon }} style={styles.sectionIconImg} contentFit="contain" />
          <Text style={styles.sectionTitle}>Your Spending</Text>
        </View>
        <TouchableOpacity style={styles.seeMorePill}>
          <Text style={styles.seeMoreText}>see more</Text>
          <Image source={{ uri: seeMoreArrow }} style={styles.seeMoreArrowImg} contentFit="contain" />
        </TouchableOpacity>
      </View>

      {/* ── Spending categories card ── */}
      <View style={styles.categoriesCard}>
        {CATEGORIES.map((cat, i) => (
          <View
            key={cat.name}
            style={[
              styles.categoryRow,
              i < CATEGORIES.length - 1 && styles.categoryDivider,
            ]}
          >
            {/* Category icon */}
            <Image source={{ uri: cat.icon }} style={styles.categoryIcon} contentFit="contain" />

            {/* Category name */}
            <Text style={styles.categoryName}>{cat.name}</Text>

            {/* Progress bar with budget marker */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${cat.fill * 100}%` }]} />
              <View style={[styles.budgetMarker, { left: `${cat.fill * 100}%` }]}>
                <Image source={{ uri: budgetMarkerLine }} style={styles.budgetMarkerImg} contentFit="fill" />
              </View>
            </View>

            {/* Amount */}
            <View style={styles.amountGroup}>
              <Image source={{ uri: dollarSignSmall }} style={styles.dollarSmall} contentFit="contain" />
              <Text style={styles.categoryAmount}>{cat.amount}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Upcoming Expenses header ── */}
      <View style={styles.sectionRow}>
        <Image source={{ uri: calendarIcon }} style={styles.calendarIconImg} contentFit="contain" />
        <Text style={styles.sectionTitle}>Upcoming Expenses</Text>
      </View>
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
