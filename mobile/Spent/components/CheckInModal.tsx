import React, { useState } from 'react';
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
const coffeeIcon        = require('../assets/icons/coffeeIcon.svg');
const shoppingIcon      = require('../assets/icons/shoppingIcon.svg');
const entertainmentIcon = require('../assets/icons/entertainmentIcon.svg');
const otherIcon         = require('../assets/icons/otherIcon.svg');
const clipboardIcon     = require('../assets/icons/clipboardIcon.svg');
const flameIcon         = require('../assets/icons/flameIcon.svg');
const dollarSignSmall   = require('../assets/icons/dollarSignSmall.svg');
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN  = '#0a542f';
const LIME_GREEN  = '#cdf545';
const MINT        = '#d2f3e2';
const OVERLAY_BG  = 'rgba(131,135,117,0.92)';
const CARD_WIDTH  = SCREEN_WIDTH * 0.82;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.56;
// ─────────────────────────────────────────────────────────────────────────────

const MAPS_KEY = GOOGLE_MAPS_KEY;

function staticMapUrl(address: string): string {
  const addr = encodeURIComponent(address);
  const marker = encodeURIComponent(`color:green|${address}`);
  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${addr}` +
    `&zoom=16` +
    `&size=600x400` +
    `&scale=2` +
    `&markers=${marker}` +
    `&key=${MAPS_KEY}`;
  console.log('[Map URL]', url);
  return url;
}

interface Location {
  id: number;
  name: string;
  category: string;
  address: string;
  icon: any;
  accentColor: string;
}

const LOCATIONS: Location[] = [
  {
    id: 1,
    name: 'Starbucks',
    category: 'Coffee',
    address: '100 Newbury St, Boston, MA',
    icon: coffeeIcon,
    accentColor: MINT,
  },
  {
    id: 2,
    name: 'Brookline Booksmith',
    category: 'Shopping',
    address: '279 Harvard St, Brookline, MA',
    icon: shoppingIcon,
    accentColor: '#fde8f5',
  },
  {
    id: 3,
    name: 'Barcelona Wine Bar',
    category: 'Entertainment',
    address: '1700 Washington St, Boston, MA',
    icon: entertainmentIcon,
    accentColor: '#ede8fd',
  },
  {
    id: 4,
    name: 'CVS Pharmacy',
    category: 'Other',
    address: '36 JFK St, Cambridge, MA',
    icon: otherIcon,
    accentColor: '#fef3e2',
  },
];

// ── Swipe card ────────────────────────────────────────────────────────────────
interface SwipeCardProps {
  location: Location;
  onSwipe: (direction: 'left' | 'right') => void;
  isTop: boolean;
  stackIndex: number;
}

function SwipeCard({ location, onSwipe, isTop, stackIndex }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.15;
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        translateX.value = withSpring(
          e.translationX > 0 ? SCREEN_WIDTH * 1.6 : -SCREEN_WIDTH * 1.6,
          { velocity: e.velocityX }
        );
        runOnJS(onSwipe)(e.translationX > 0 ? 'right' : 'left');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardAnimStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-16, 0, 16],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const visitedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const skippedOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // Each card in the stack scales down slightly and peeks below the top card
  const scale      = 1 - stackIndex * 0.06;
  const peekOffset = stackIndex * 14; // positive = shifts down so cards peek below

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          // Lower cards: scaled down and shifted down so edges peek below top card
          !isTop && {
            transform: [{ scale }, { translateY: peekOffset }],
            zIndex: 10 - stackIndex,
          },
          // Top card: full animated transform
          isTop && [cardAnimStyle, { zIndex: 10 }],
        ]}
      >
        {/* ── Map ── */}
        <View style={styles.mapContainer}>
          <RNImage
            source={{ uri: staticMapUrl(location.address) }}
            style={styles.mapImage}
            resizeMode="cover"
            onError={(e) => console.log('[Map Error]', e.nativeEvent.error)}
          />
          {/* Category pill over map */}
          <View style={[styles.categoryPill, { backgroundColor: location.accentColor }]}>
            <Image source={location.icon} style={styles.categoryIcon} contentFit="contain" />
            <Text style={styles.categoryText}>{location.category}</Text>
          </View>
        </View>

        {/* ── Card body ── */}
        <View style={styles.cardBody}>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.locationAddress}>{location.address}</Text>

          {/* Spend hint row */}
          <View style={styles.spendRow}>
            <Image source={dollarSignSmall} style={styles.dollarIcon} contentFit="contain" />
            <Text style={styles.spendText}>Did you spend here today?</Text>
          </View>
        </View>

        {/* ── Swipe overlays ── */}
        {isTop && (
          <>
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
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CheckInModal({ visible, onClose }: CheckInModalProps) {
  const { addCheckInResult } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = (direction: 'left' | 'right') => {
    const location = LOCATIONS[currentIndex];
    addCheckInResult({
      location: location.name,
      category: location.category,
      visited: direction === 'right',
      timestamp: new Date(),
    });

    const next = currentIndex + 1;
    if (next >= LOCATIONS.length) {
      setTimeout(() => {
        setCurrentIndex(0);
        onClose();
      }, 350);
    } else {
      setCurrentIndex(next);
    }
  };

  const remaining = LOCATIONS.slice(currentIndex);

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

        {/* ── Card stack ── */}
        <View style={styles.cardStack}>
          {remaining.length > 0
            ? [...remaining].reverse().map((location, ri) => {
                const stackIndex = remaining.length - 1 - ri;
                return (
                  <SwipeCard
                    key={location.id}
                    location={location}
                    onSwipe={handleSwipe}
                    isTop={stackIndex === 0}
                    stackIndex={stackIndex}
                  />
                );
              })
            : (
              <View style={styles.doneCard}>
                <Text style={styles.doneTitle}>All done!</Text>
                <Text style={styles.doneSubtitle}>Check-in saved.</Text>
              </View>
            )
          }
        </View>

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
const MAP_HEIGHT = CARD_HEIGHT * 0.48;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_BG,
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: CARD_WIDTH,
    marginBottom: 6,
  },
  headerIcon: {
    width: 18,
    height: 22,
  },
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
  flameIcon: {
    width: 9,
    height: 11,
  },
  streakText: {
    fontSize: 12,
    color: LIME_GREEN,
    fontWeight: '600',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
  },

  // Card stack
  cardStack: {
    width: CARD_WIDTH,
    // Extra height so the peeking cards below the top card are visible (3 cards * 14px offset)
    height: CARD_HEIGHT + 42,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  // Map
  mapContainer: {
    width: '100%',
    height: MAP_HEIGHT,
    position: 'relative',
  },
  mapImage: {
    width: CARD_WIDTH,
    height: MAP_HEIGHT,
  },
  categoryPill: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryIcon: {
    width: 16,
    height: 16,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: DARK_GREEN,
  },

  // Card body
  cardBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  locationName: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK_GREEN,
  },
  locationAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dollarIcon: {
    width: 14,
    height: 14,
  },
  spendText: {
    fontSize: 11,
    color: '#aaa',
  },

  // Swipe overlays
  visitedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,84,47,0.12)',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 18,
  },
  skippedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(192,57,43,0.1)',
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
  overlayStampText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Progress dots
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 22,
    borderRadius: 4,
  },
  dotDone: {
    backgroundColor: LIME_GREEN,
  },

  // Done state
  doneCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: MINT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DARK_GREEN,
  },
  doneSubtitle: {
    fontSize: 14,
    color: DARK_GREEN,
    opacity: 0.7,
  },
});
