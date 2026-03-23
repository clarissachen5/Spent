import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_MAPS_KEY } from '../constants/config';

// ── Icons ─────────────────────────────────────────────────────────────────────
const coffeeIcon      = require('../assets/icons/coffeeIcon.svg');
const shoppingIcon    = require('../assets/icons/shoppingIcon.svg');
const foodIcon        = require('../assets/icons/foodIcon.svg');
const clipboardIcon   = require('../assets/icons/clipboardIcon.svg');
const flameIcon       = require('../assets/icons/flameIcon.svg');
const dollarSignSmall = require('../assets/icons/dollarSignSmall.svg');
const dollarSignLarge = require('../assets/icons/dollarSignLarge.svg');
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SLIDER_TRACK_W  = SCREEN_WIDTH * 0.88 - 48;
const THUMB_RADIUS    = 13;

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN   = '#0a542f';
const LIME_GREEN   = '#cdf545';
const OVERLAY_BG   = 'rgba(131,135,117,0.92)';
const CARD_WIDTH   = SCREEN_WIDTH * 0.88;
const CARD_HEIGHT  = SCREEN_HEIGHT * 0.44;
const COLLAPSED_H  = 52;
const CARD_RADIUS  = 20;
// ─────────────────────────────────────────────────────────────────────────────

// Collapsed card colors: index 0 = closest to front (lightest), 2 = furthest back (darkest)
const COLLAPSED_BG   = ['#D8D8D8', '#FFFFFF', '#302C6E'];
const COLLAPSED_TEXT = ['#1e1d19', '#1e1d19', '#FFFFFF'];

interface Location {
  id:           number;
  name:         string;
  category:     string;
  address:      string;
  neighborhood: string;
  icon:         any;
  accentColor:  string;
}

const LOCATIONS: Location[] = [
  {
    id:           1,
    name:         'Starbucks',
    category:     'Coffee',
    address:      '100 Newbury St, Boston, MA',
    neighborhood: 'Back Bay, MA',
    icon:         coffeeIcon,
    accentColor:  '#FFF0F8',
  },
  {
    id:           2,
    name:         'Brookline Booksmith',
    category:     'Shopping',
    address:      '279 Harvard St, Brookline, MA',
    neighborhood: 'Coolidge Corner, MA',
    icon:         shoppingIcon,
    accentColor:  '#F0FBF5',
  },
  {
    id:           3,
    name:         'Barcelona Wine Bar',
    category:     'Food',
    address:      '1700 Washington St, Boston, MA',
    neighborhood: 'South End, MA',
    icon:         foodIcon,
    accentColor:  '#F5F0FF',
  },
  {
    id:           4,
    name:         'CVS Pharmacy',
    category:     'Shopping',
    address:      '36 JFK St, Cambridge, MA',
    neighborhood: 'Harvard Square, MA',
    icon:         shoppingIcon,
    accentColor:  '#FFFBF0',
  },
];

function formatCheckInTime(): string {
  const d    = new Date();
  const h    = d.getHours() % 12 || 12;
  const m    = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return `Today @${h}:${m}${ampm}`;
}

function staticMapUrl(address: string): string {
  const addr   = encodeURIComponent(address);
  const marker = encodeURIComponent(`color:0x0a542f|${address}`);
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${addr}&zoom=16&size=600x320&scale=2&maptype=roadmap` +
    `&markers=${marker}&key=${GOOGLE_MAPS_KEY}`
  );
}

// ── Collapsed card ─────────────────────────────────────────────────────────────
function CollapsedCard({ location, distFromFront }: { location: Location; distFromFront: number }) {
  const idx = Math.min(distFromFront, 2);
  return (
    <View style={[styles.collapsedCard, { backgroundColor: COLLAPSED_BG[idx] }]}>
      <Image source={location.icon} style={styles.collapsedIcon} contentFit="contain" />
      <Text style={[styles.collapsedName, { color: COLLAPSED_TEXT[idx] }]}>{location.name}</Text>
    </View>
  );
}

// ── Active (expanded) card ─────────────────────────────────────────────────────
interface ActiveCardProps {
  location: Location;
  onSwipe:  (direction: 'left' | 'right', amount?: number) => void;
}

function ActiveCard({ location, onSwipe }: ActiveCardProps) {
  const [isFlipped, setIsFlipped]         = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);
  const checkInTime = useRef(formatCheckInTime()).current;

  const translateX   = useSharedValue(0);
  const translateY   = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const thumbOffset  = useSharedValue(0);
  const startOffset  = useSharedValue(0);

  // ── Main swipe gesture ──
  const mainGesture = Gesture.Pan()
    .enabled(!isFlipped)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.1;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        // Snap back then flip to spending card
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        flipProgress.value = withSpring(1, { damping: 14, stiffness: 120 });
        runOnJS(setIsFlipped)(true);
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        // Fly off left → skipped
        translateX.value = withSpring(
          -SCREEN_WIDTH * 1.6,
          { velocity: e.velocityX },
          () => runOnJS(onSwipe)('left'),
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  // ── Slider gesture (spending card) ──
  const sliderGesture = Gesture.Pan()
    .enabled(isFlipped)
    .onBegin(() => { startOffset.value = thumbOffset.value; })
    .onUpdate(e => {
      const next = Math.max(0, Math.min(SLIDER_TRACK_W, startOffset.value + e.translationX));
      thumbOffset.value = next;
      runOnJS(setDisplayAmount)(Math.round((next / SLIDER_TRACK_W) * 100));
    });

  const handleLog = () => {
    translateX.value = withSpring(
      SCREEN_WIDTH * 1.6,
      { velocity: 800 },
      () => runOnJS(onSwipe)('right', displayAmount),
    );
  };

  // ── Animated styles ──
  const wrapperStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-10, 0, 10], Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` },
    ],
    opacity: interpolate(flipProgress.value, [0.38, 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: interpolate(flipProgress.value, [0.5, 0.62], [0, 1], Extrapolation.CLAMP),
  }));

  const visitedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const skippedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: thumbOffset.value }] }));
  const fillStyle  = useAnimatedStyle(() => ({ width: thumbOffset.value + THUMB_RADIUS }));

  const MAP_HEIGHT = CARD_HEIGHT * 0.52;

  return (
    <GestureDetector gesture={mainGesture}>
      <Animated.View style={[styles.cardWrapper, wrapperStyle]}>

        {/* ── Front face ── */}
        <Animated.View style={[styles.cardFace, { backgroundColor: location.accentColor }, frontStyle]}>

          {/* Name row */}
          <View style={styles.nameRow}>
            <Image source={location.icon} style={styles.activeIcon} contentFit="contain" />
            <Text style={styles.activeName}>{location.name}</Text>
          </View>

          {/* Time + neighborhood */}
          <View style={styles.timeRow}>
            <View style={styles.timePinkBar} />
            <View>
              <Text style={styles.timeText}>{checkInTime}</Text>
              <Text style={styles.neighborhoodText}>{location.neighborhood}</Text>
            </View>
          </View>

          {/* Map */}
          <RNImage
            source={{ uri: staticMapUrl(location.address) }}
            style={[styles.mapImage, { height: MAP_HEIGHT }]}
            resizeMode="cover"
          />

          {/* Swipe stamps */}
          <Animated.View style={[styles.visitedOverlay, visitedOpacity]}>
            <View style={[styles.overlayStamp, { borderColor: DARK_GREEN }]}>
              <Text style={[styles.overlayStampText, { color: DARK_GREEN }]}>VISITED</Text>
            </View>
          </Animated.View>
          <Animated.View style={[styles.skippedOverlay, skippedOpacity]}>
            <View style={[styles.overlayStamp, { borderColor: '#c0392b' }]}>
              <Text style={[styles.overlayStampText, { color: '#c0392b' }]}>SKIPPED</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* ── Back face (spending card) ── */}
        <Animated.View style={[styles.cardFace, styles.cardBack, backStyle]}>
          {/* Accent band */}
          <View style={[styles.backBand, { backgroundColor: location.accentColor }]}>
            <Image source={location.icon} style={styles.collapsedIcon} contentFit="contain" />
            <Text style={styles.activeName}>{location.name}</Text>
          </View>

          {/* Amount */}
          <View style={styles.amountRow}>
            <Image source={dollarSignLarge} style={styles.dollarLarge} contentFit="contain" />
            <Text style={styles.amountText}>{displayAmount}</Text>
          </View>
          <Text style={styles.howMuchLabel}>How much did you spend?</Text>

          {/* Slider */}
          <GestureDetector gesture={sliderGesture}>
            <View style={styles.sliderWrapper}>
              <View style={styles.sliderTrack}>
                <Animated.View style={[styles.sliderFill, fillStyle]} />
                <Animated.View style={[styles.sliderThumb, thumbStyle]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>$0</Text>
                <Text style={styles.sliderLabel}>$100</Text>
              </View>
            </View>
          </GestureDetector>

          {/* Log button */}
          <TouchableOpacity style={styles.logBtn} onPress={handleLog} activeOpacity={0.85}>
            <Text style={styles.logBtnText}>Log ${displayAmount}</Text>
          </TouchableOpacity>
        </Animated.View>

      </Animated.View>
    </GestureDetector>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface CheckInModalProps {
  visible:  boolean;
  onClose:  () => void;
}

export default function CheckInModal({ visible, onClose }: CheckInModalProps) {
  const { addCheckInResult } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = (direction: 'left' | 'right', amount?: number) => {
    const location = LOCATIONS[currentIndex];
    addCheckInResult({
      location:  location.name,
      category:  location.category,
      visited:   direction === 'right',
      amount:    direction === 'right' ? (amount ?? 0) : undefined,
      timestamp: new Date(),
    });
    const next = currentIndex + 1;
    if (next >= LOCATIONS.length) {
      setTimeout(() => { setCurrentIndex(0); onClose(); }, 350);
    } else {
      setCurrentIndex(next);
    }
  };

  const remaining = LOCATIONS.slice(currentIndex);
  const active    = remaining[0];
  // upcoming cards shown collapsed above the active one, back-to-front order
  const collapsed = remaining.slice(1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Image source={clipboardIcon} style={styles.headerIcon} contentFit="contain" />
          <Text style={styles.headerTitle}>Check In</Text>
          <View style={styles.streakPill}>
            <Image source={flameIcon} style={styles.flameIcon} contentFit="contain" />
            <Text style={styles.streakText}>3</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>Swipe right if you visited, left if not</Text>

        {/* ── Stack ── */}
        {remaining.length > 0 ? (
          <View style={styles.stackContainer}>
            {/* Collapsed upcoming cards — rendered back-to-front (top of screen = furthest back) */}
            {[...collapsed].reverse().map((loc, i) => (
              <CollapsedCard
                key={loc.id}
                location={loc}
                distFromFront={collapsed.length - 1 - i}
              />
            ))}
            {/* Active expanded card */}
            <ActiveCard key={active.id} location={active} onSwipe={handleSwipe} />
          </View>
        ) : (
          <View style={styles.doneCard}>
            <Text style={styles.doneTitle}>All done!</Text>
            <Text style={styles.doneSubtitle}>Check-in saved.</Text>
          </View>
        )}

        {/* ── Progress dots ── */}
        <View style={styles.dots}>
          {LOCATIONS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentIndex  && styles.dotDone,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_BG,
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 40,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: CARD_WIDTH,
    marginBottom: 6,
  },
  headerIcon: { width: 18, height: 22 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DARK_GREEN,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  flameIcon: { width: 9, height: 11 },
  streakText: { fontSize: 12, color: LIME_GREEN, fontWeight: '600' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },

  // ── Card stack container ──
  stackContainer: {
    width: CARD_WIDTH,
    gap: 6,
  },

  // ── Collapsed cards ──
  collapsedCard: {
    width: CARD_WIDTH,
    height: COLLAPSED_H,
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  collapsedIcon: { width: 22, height: 22 },
  collapsedName: { fontSize: 14, fontWeight: '700' },

  // ── Active card wrapper (holds both faces) ──
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  cardFace: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },

  // ── Front face layout ──
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  activeIcon: { width: 22, height: 22 },
  activeName: { fontSize: 15, fontWeight: '700', color: '#1e1d19' },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  timePinkBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#FFB5DB',
    alignSelf: 'stretch',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e1d19',
  },
  neighborhoodText: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  mapImage: {
    width: CARD_WIDTH,
  },

  // Swipe stamps
  visitedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,84,47,0.10)',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 18,
  },
  skippedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(192,57,43,0.08)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 18,
  },
  overlayStamp: {
    borderWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  overlayStampText: { fontSize: 18, fontWeight: '900', letterSpacing: 2 },

  // ── Back face (spending card) ──
  cardBack: {
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  backBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  dollarLarge: { width: 24, height: 32 },
  amountText: { fontSize: 52, fontWeight: '800', color: DARK_GREEN, lineHeight: 60 },
  howMuchLabel: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 2 },
  sliderWrapper: { paddingHorizontal: 24, marginTop: 16 },
  sliderTrack: {
    height: 6,
    backgroundColor: '#e8e8e8',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    backgroundColor: DARK_GREEN,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    left: -THUMB_RADIUS,
    top: -(THUMB_RADIUS - 3),
    width: THUMB_RADIUS * 2,
    height: THUMB_RADIUS * 2,
    borderRadius: THUMB_RADIUS,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: DARK_GREEN,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sliderLabel: { fontSize: 10, color: '#aaa', fontWeight: '500' },
  logBtn: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: LIME_GREEN,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logBtnText: { fontSize: 14, fontWeight: '700', color: DARK_GREEN },

  // ── Progress dots ──
  dots: { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 22, borderRadius: 4 },
  dotDone:   { backgroundColor: LIME_GREEN },

  // ── Done card ──
  doneCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#d2f3e2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneTitle:    { fontSize: 28, fontWeight: '700', color: DARK_GREEN },
  doneSubtitle: { fontSize: 14, color: DARK_GREEN, opacity: 0.7 },
});
