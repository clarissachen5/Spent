import { Image } from "expo-image";
import { Link } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useEffect, useState } from "react";

import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import * as firebase from '../../src/config/firebase';
// 1) Types for your backend responses
type HealthResponse = {
  status: string;
};

// 2) Point this at your FastAPI server
// IMPORTANT: use your laptop LAN IP when testing on a physical phone
const BASE_URL = "http://127.0.0.1:8000"; // change to e.g. "http://192.168.1.23:8000" for Expo Go on phone

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/health`);

  if (!res.ok) {
    // Try to include useful info when debugging
    const text = await res.text().catch(() => "");
    throw new Error(`Health check failed: ${res.status} ${res.statusText} ${text}`);
  }

  // Narrow the type at the boundary
  return (await res.json()) as HealthResponse;
}

export default function HomeScreen() {
  console.log('firebase instance:', firebase)
  // 3) Typed state for loading/data/error
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 4) Call backend on screen load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchHealth();
        if (!cancelled) setHealth(data);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome!</ThemedText>
        <HelloWave />
      </ThemedView>

      {/* Backend status block */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Backend status</ThemedText>

        {loading ? (
          <ThemedText>Checking backend…</ThemedText>
        ) : error ? (
          <ThemedText>
            Error: <ThemedText type="defaultSemiBold">{error}</ThemedText>
          </ThemedText>
        ) : (
          <ThemedText>
            Health: <ThemedText type="defaultSemiBold">{health?.status}</ThemedText>
          </ThemedText>
        )}

        <ThemedText>
          If you&apos;re using Expo Go on a phone, set{" "}
          <ThemedText type="defaultSemiBold">BASE_URL</ThemedText> to your laptop&apos;s Wi-Fi IP
          (ex: <ThemedText type="defaultSemiBold">http://192.168.1.23:8000</ThemedText>).
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{" "}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: "cmd + d",
              android: "cmd + m",
              web: "F12",
            })}
          </ThemedText>{" "}
          to open developer tools.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert("Action pressed")} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert("Share pressed")}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert("Delete pressed")}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{" "}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{" "}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{" "}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});