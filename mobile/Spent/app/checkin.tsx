import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import Slider from "@react-native-community/slider";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CheckIn() {
  const { token } = useLocalSearchParams();
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  const locations = [
    { name: "Starbucks", category: "Dining" },
    { name: "Whole Foods", category: "Groceries" },
    { name: "Uber", category: "Uber" },
  ];

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({
    Starbucks: 10,
    "Whole Foods": 15,
    Uber: 10,
  });

  const handleSpend = (location: any) => {
    router.replace({
      pathname: "/(tabs)",
      params: {
        token,
        location: location.name,
        category: location.category,
        amount: sliderValues[location.name],
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Where are you?</Text>

      {locations.map((location) => {
        const isActive = activeLocation === location.name;
        const currentValue = sliderValues[location.name] || 10;

        return (
          <View key={location.name} style={styles.cardContainer}>
            <TouchableOpacity
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut
                );
                setActiveLocation(isActive ? null : location.name);
              }}
            >
              <Text style={styles.cardTitle}>{location.name}</Text>
            </TouchableOpacity>

            {isActive && (
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Spend: ${currentValue}</Text>

                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={50}
                  step={1}
                  value={currentValue}
                  minimumTrackTintColor="#C7F36B"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#111"
                  onValueChange={(value) =>
                    setSliderValues((prev) => ({
                      ...prev,
                      [location.name]: value,
                    }))
                  }
                />

                <View style={styles.rangeLabels}>
                  <Text style={styles.rangeText}>$0</Text>
                  <Text style={styles.rangeText}>$50</Text>
                </View>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleSpend(location)}
                >
                  <Text style={styles.confirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    backgroundColor: "#f7f7f7",
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 25,
    color: "#111",
  },

  cardContainer: {
    marginBottom: 20,
  },

  card: {
    backgroundColor: "white",
    padding: 22,
    borderRadius: 20,

    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },

    elevation: 6,
  },

  cardActive: {
    borderWidth: 2,
    borderColor: "#C7F36B",
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },

  sliderContainer: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },

  sliderLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#111",
  },

  slider: {
    width: "100%",
    height: 40,
  },

  rangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },

  rangeText: {
    fontSize: 13,
    color: "#666",
  },

  confirmButton: {
    marginTop: 16,
    backgroundColor: "#C7F36B",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  confirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
});
