import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { app } from '../src/config/firebase';
import { GOOGLE_MAPS_KEY } from '../constants/config';
import { USER_ID_KEY } from '../context/AuthContext';

const LOCATION_TASK_NAME = 'spent-background-location';
const DWELL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const DWELL_RADIUS_M = 50;                 // metres — within this counts as same place

const KEY_DWELL = 'spent_dwell_state';
const KEY_LAST_FLASHCARD = 'spent_last_flashcard_ts';

interface DwellState {
  latitude: number;
  longitude: number;
  arrivedAt: number; // Unix ms
}

// ── Haversine distance in metres ──────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Map Google place types to app categories ──────────────────────────────────
function inferCategory(types: string[]): string {
  if (types.some(t => ['cafe', 'bakery'].includes(t))) return 'Coffee';
  if (types.some(t => ['restaurant', 'food', 'bar', 'meal_takeaway', 'meal_delivery'].includes(t))) return 'Food';
  if (types.some(t => ['store', 'shopping_mall', 'clothing_store', 'book_store', 'supermarket', 'convenience_store'].includes(t))) return 'Shopping';
  if (types.some(t => ['movie_theater', 'museum', 'amusement_park', 'gym', 'stadium'].includes(t))) return 'Entertainment';
  if (types.some(t => ['transit_station', 'bus_station', 'train_station', 'subway_station', 'airport'].includes(t))) return 'Transportation';
  return 'Other';
}

// ── Fetch nearest business via Google Places, then save to Firestore ──────────
async function createDetectedLocation(lat: number, lng: number, arrivedAt: number) {
  try {
    const placesResp = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}&rankby=distance&key=${GOOGLE_MAPS_KEY}`
    );
    const place = placesResp.data.results?.[0];
    if (!place) return;

    const userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) {
      console.warn('[LocationTracker] no userId in storage, skipping save');
      return;
    }
    const db = getFirestore(app);
    await addDoc(collection(db, 'users', userId, 'detected_locations'), {
      google_place_id: place.place_id,
      place_name:      place.name,
      address:         place.vicinity ?? '',
      category:        inferCategory(place.types ?? []),
      latitude:        lat,
      longitude:       lng,
      arrived_at:      new Date(arrivedAt).toISOString(),
      flashcard_shown: false,
      created_at:      new Date().toISOString(),
    });
  } catch (e) {
    console.error('[LocationTracker] failed to create detected location:', e);
  }
}

// ── Background task ───────────────────────────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.error('[LocationTracker] task error:', error);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const loc = locations?.[0];
  if (!loc) return;

  const { latitude, longitude } = loc.coords;
  const now = Date.now();

  const dwellJson = await AsyncStorage.getItem(KEY_DWELL);
  const dwell: DwellState | null = dwellJson ? JSON.parse(dwellJson) : null;

  if (dwell) {
    const dist = haversineDistance(latitude, longitude, dwell.latitude, dwell.longitude);

    if (dist <= DWELL_RADIUS_M) {
      // Still at the same place — check if 5 min threshold has been crossed
      const duration = now - dwell.arrivedAt;
      if (duration >= DWELL_THRESHOLD_MS) {
        // Only fire once per visit: don't fire again until user leaves and returns
        const lastTs = await AsyncStorage.getItem(KEY_LAST_FLASHCARD);
        const lastFired = lastTs ? parseInt(lastTs, 10) : 0;
        if (lastFired < dwell.arrivedAt) {
          await createDetectedLocation(latitude, longitude, dwell.arrivedAt);
          await AsyncStorage.setItem(KEY_LAST_FLASHCARD, String(now));
        }
      }
    } else {
      // Moved away — reset dwell to new location
      await AsyncStorage.setItem(KEY_DWELL, JSON.stringify({ latitude, longitude, arrivedAt: now }));
    }
  } else {
    // First reading — start tracking
    await AsyncStorage.setItem(KEY_DWELL, JSON.stringify({ latitude, longitude, arrivedAt: now }));
  }
});

// ── Public API ────────────────────────────────────────────────────────────────
export async function startLocationTracking(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') return false;

  const already = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (already) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 20,            // update every 20 metres moved
    deferredUpdatesInterval: 60_000, // or every 60 seconds
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Spent',
      notificationBody: 'Tracking location to detect places you visit',
      notificationColor: '#4F090B',
    },
  });

  return true;
}

export async function stopLocationTracking(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (registered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
