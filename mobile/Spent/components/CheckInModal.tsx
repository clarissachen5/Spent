import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
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

// ── Icons ─────────────────────────────────────────────────────────────────────
const coffeeIcon        = require('../assets/icons/coffeeIcon.svg');
const shoppingIcon      = require('../assets/icons/shoppingIcon.svg');
const entertainmentIcon = require('../assets/icons/entertainmentIcon.svg');
const otherIcon         = require('../assets/icons/otherIcon.svg');
const foodIcon          = require('../assets/icons/foodIcon.svg');
const clipboardIcon     = require('../assets/icons/clipboardIcon.svg');
const chevronLeft       = require('../assets/icons/chevronLeft.svg');
const chevronRight      = require('../assets/icons/chevronRight.svg');
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_GREEN = '#0a542f';
const LIME_GREEN = '#cdf545';
const MINT       = '#d2f3e2';
const OVERLAY_BG = 'rgba(131,135,117,0.85)';
// ─────────────────────────────────────────────────────────────────────────────

interface Location {
  id: number;
  name: string;
  category: string;
  address: string;
  icon: any;
  cardColor: string;
}

const LOCATIONS: Location[] = [
  {
    id: 1,
    name: 'Starbucks',
    category: 'Coffee',
    address: '100 Newbury St, Boston',
    icon: coffeeIcon,
    cardColor: '#d2f3e2',
  },
  {
    id: 2,
    name: 'Brookline Booksmith',
    category: 'Shopping',
    address: '279 Harvard St, Brookline',
    icon: shoppingIcon,
    cardColor: '#fde8f5',
  },
  {
    id: 3,
    name: 'Barcelona Wine Bar',
    category: 'Entertainment',
    address: '1700 Washington St, Boston',
    icon: entertainmentIcon,
    cardColor: '#ede8fd',
  },
  {
    id: 4,
    name: 'CVS Pharmacy',
    category: 'Other',
    address: '36 JFK St, Cambridge',
    icon: otherIcon,
    cardColor: '#fef3e2',
  },
];

// ── Single swipeable card ─────────────────────────────────────────────────────
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
      translateY.value = e.translationY * 0.2;
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const direction = e.translationX > 0 ? 'right' : 'left';
        translateX.value = withSpring(
          e.translationX > 0 ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
          { velocity: e.velocityX }
        );
        runOnJS(onSwipe)(direction);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-18, 0, 18],
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

  // Green overlay fades in on right swipe
  const visitedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  // Pink overlay fades in on left swipe
  const skippedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // Cards beneath scale up slightly as top card moves
  const scaleOffset = stackIndex * 0.04;
  const yOffset = stackIndex * 10;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: location.cardColor },
          !isTop && {
            transform: [
              { scale: 1 - scaleOffset },
              { translateY: yOffset },
            ],
            zIndex: -stackIndex,
          },
          isTop && cardStyle,
          isTop && { zIndex: 10 },
        ]}
      >
        {/* Visited overlay (right swipe) */}
        {isTop && (
          <Animated.View style={[styles.visitedOverlay, visitedOverlayStyle]}>
            <View style={styles.overlayBadge}>
              <Image source={chevronRight} style={styles.overlayIcon} contentFit="contain" />
              <Text style={styles.overlayTextVisited}>Visited</Text>
            </View>
          </Animated.View>
        )}

        {/* Skipped overlay (left swipe) */}
        {isTop && (
          <Animated.View style={[styles.skippedOverlay, skippedOverlayStyle]}>
            <View style={styles.overlayBadge}>
              <Image source={chevronLeft} style={[styles.overlayIcon, { transform: [{ rotate: '180deg' }] }]} contentFit="contain" />
              <Text style={styles.overlayTextSkipped}>Skipped</Text>
            </View>
          </Animated.View>
        )}

        {/* Card content */}
        <View style={styles.cardIconWrapper}>
          <Image source={location.icon} style={styles.cardIcon} contentFit="contain" />
        </View>

        <Text style={styles.cardName}>{location.name}</Text>
        <Text style={styles.cardCategory}>{location.category}</Text>
        <Text style={styles.cardAddress}>{location.address}</Text>

        <View style={styles.cardHint}>
          <Image source={chevronLeft} style={[styles.hintIcon, { transform: [{ rotate: '180deg' }] }]} contentFit="contain" />
          <Text style={styles.hintText}>swipe to respond</Text>
          <Image source={chevronRight} style={styles.hintIcon} contentFit="contain" />
        </View>
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
      // All cards done — close after a short delay
      setTimeout(() => {
        setCurrentIndex(0);
        onClose();
      }, 300);
    } else {
      setCurrentIndex(next);
    }
  };

  const remaining = LOCATIONS.slice(currentIndex);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={clipboardIcon} style={styles.headerIcon} contentFit="contain" />
          <Text style={styles.headerTitle}>Check In</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subTitle}>Were you at any of these places?</Text>

        {/* Card stack */}
        {remaining.length > 0 ? (
          <View style={styles.cardStack}>
            {/* Render bottom cards first, top card last */}
            {[...remaining].reverse().map((location, reversedIndex) => {
              const stackIndex = remaining.length - 1 - reversedIndex;
              const isTop = stackIndex === 0;
              return (
                <SwipeCard
                  key={location.id}
                  location={location}
                  onSwipe={handleSwipe}
                  isTop={isTop}
                  stackIndex={stackIndex}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.doneContainer}>
            <Text style={styles.doneText}>All done!</Text>
          </View>
        )}

        {/* Progress dots */}
        <View style={styles.dots}>
          {LOCATIONS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentIndex && styles.dotDone,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Button hints */}
        <View style={styles.buttonRow}>
          <View style={[styles.actionBtn, styles.skipBtn]}>
            <Image source={chevronLeft} style={[styles.actionIcon, { transform: [{ rotate: '180deg' }] }]} contentFit="contain" />
            <Text style={styles.skipLabel}>Didn't go</Text>
          </View>
          <View style={[styles.actionBtn, styles.visitBtn]}>
            <Text style={styles.visitLabel}>Visited</Text>
            <Image source={chevronRight} style={styles.actionIcon} contentFit="contain" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CARD_WIDTH = SCREEN_WIDTH * 0.78;
const CARD_HEIGHT = CARD_WIDTH * 1.35;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_BG,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  headerIcon: {
    width: 20,
    height: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 32,
  },

  // Card stack
  cardStack: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    padding: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    gap: 12,
  },

  // Swipe overlays
  visitedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,84,47,0.35)',
    borderRadius: 24,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 20,
  },
  skippedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,100,100,0.3)',
    borderRadius: 24,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 20,
  },
  overlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  overlayIcon: {
    width: 10,
    height: 10,
  },
  overlayTextVisited: {
    fontSize: 13,
    fontWeight: '700',
    color: DARK_GREEN,
  },
  overlayTextSkipped: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c0392b',
  },

  // Card content
  cardIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardIcon: {
    width: 36,
    height: 36,
  },
  cardName: {
    fontSize: 24,
    fontWeight: '700',
    color: DARK_GREEN,
    textAlign: 'center',
  },
  cardCategory: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  cardAddress: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: -4,
  },
  cardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    opacity: 0.4,
  },
  hintIcon: {
    width: 8,
    height: 12,
  },
  hintText: {
    fontSize: 11,
    color: '#444',
  },

  // Progress dots
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  dotDone: {
    backgroundColor: LIME_GREEN,
  },

  // Bottom button hints
  buttonRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
  },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  visitBtn: {
    backgroundColor: DARK_GREEN,
  },
  actionIcon: {
    width: 10,
    height: 14,
  },
  skipLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  visitLabel: {
    color: LIME_GREEN,
    fontSize: 14,
    fontWeight: '600',
  },

  // Done state
  doneContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
});
