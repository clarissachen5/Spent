import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL, GOOGLE_MAPS_KEY } from '../constants/config';

const LOCATION_TASK_NAME = 'spent-background-location';
const DWELL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const DWELL_RADIUS_M = 50; // metres — within this radius counts as "same place"

// ── AsyncStorage keys ─────────────────────────────────────────────────────────
const KEY_DWELL = 'spent_dwell_state';
const KEY_LAST_FLASHCARD = 'spent_last_flashcard_ts';

interface DwellState {
  latitude: number;
  longitude: number;
  arrivedAt: number; // Unix ms
}

// ── Haversine distance (metres) ───────────────────────────────────────────────
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

// ── Google Places Nearby Search ───────────────────────────────────────────────
async function fetchNearbyPlace(lat: number, lng: number) {
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&key=${GOOGLE_MAPS_KEY}`;
  const resp = await axios.get(url);
  return resp.data.results?.[0] ?? null;
}

function inferCategory(types: string[]): string {
  if (types.some(t => ['cafe', 'bakery'].includes(t))) return 'Coffee';
  if (types.some(t => ['restaurant', 'food', 'bar', 'meal_takeaway', 'meal_delivery'].includes(t))) return 'Food';
  if (types.some(t => ['store', 'shopping_mall', 'clothing_store', 'book_store', 'supermarket', 'convenience_store'].includes(t))) return 'Shopping';
  if (types.some(t => ['movie_theater', 'museum', 'amusement_park', 'gym', 'stadium', 'art_gallery'].includes(t))) return 'Entertainment';
  if (types.some(t => ['transit_station', 'bus_station', 'train_station', 'subway_station', 'airport'].includes(t))) return 'Transportation';
  return 'Other';
}

// ── Post detected location to backend ────────────────────────────────────────
async function createDetectedLocation(lat: number, lng: number, arrivedAt: number) {
  const place = await fetchNearbyPlace(lat, lng);
  if (!place) return;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await axios.post(`${API_BASE_URL}/detected-locations`, {
    id,
    google_place_id: place.place_id,
    place_name: place.name,
    address: place.vicinity ?? '',
    category: inferCategory(place.types ?? []),
    latitude: lat,
    longitude: lng,
    arrived_at: new Date(arrivedAt).toISOString(),
  });
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
      // Still at the same place — check dwell duration
      const duration = now - dwell.arrivedAt;

      if (duration >= DWELL_THRESHOLD_MS) {
        // 5 minutes reached — check we haven't already fired for this visit
        const lastTs = await AsyncStorage.getItem(KEY_LAST_FLASHCARD);
        const lastFired = lastTs ? parseInt(lastTs, 10) : 0;

        // Only fire once per visit: don't fire again until the user has left and come back
        if (lastFired < dwell.arrivedAt) {
          await createDetectedLocation(latitude, longitude, dwell.arrivedAt);
          await AsyncStorage.setItem(KEY_LAST_FLASHCARD, String(now));
        }
      }
    } else {
      // Moved to a new place — reset dwell
      await AsyncStorage.setItem(KEY_DWELL, JSON.stringify({ latitude, longitude, arrivedAt: now }));
    }
  } else {
    // First update — start tracking
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
    distanceInterval: 20,        // update every 20 metres moved
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
