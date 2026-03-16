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

if (Platform.OS === "android") {
    UIManager.setLayoutAnimationEnabledExperimental && UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CheckIn() {
const { token } = useLocalSearchParams();
const [activeLocation, setActiveLocation] = useState<string | null>(null);

const locations = [
    { name: "Starbucks", category: "Dining"},
    { name: "Whole Foods", category: "Groceries"},
    { name: "Uber", category: "Uber"},
];

const spendOptions = [
    { label: "$", value: 10, color: "#D8B4F8" },
    { label: "$$", value: 15, color: "#C7F36B" },
    { label: "$$$", value: 25, color: "#f96868" },
];

const handleSpend = (location: any, amount: number) => {
    router.replace({
    pathname: "/(tabs)",
    params: {
        token,
        location: location.name,
        category: location.category,
        amount,
    },
    });
};

return (
    <View style={styles.container}>
    <Text style={styles.title}>Where are you?</Text>

    {locations.map((location) => {
        const isActive = activeLocation === location.name;

        return (
        <View key={location.name} style={styles.cardContainer}>

            {/* Wallet Card */}
            <TouchableOpacity
            style={[styles.card, isActive && styles.cardActive]}
            onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setActiveLocation(isActive ? null : location.name);
            }}
            >
            <Text style={styles.cardTitle}>{location.name}</Text>
            </TouchableOpacity>

            {/* Spend Buttons */}
            {isActive && (
            <View style={styles.buttonRow}>
                {spendOptions.map((option) => (
                <TouchableOpacity
                    key={option.label}
                    style={[
                    styles.spendButton,
                    { backgroundColor: option.color },
                    ]}
                    onPress={() => handleSpend(location, option.value)}
                >
                    <Text style={styles.spendText}>{option.label}</Text>
                </TouchableOpacity>
                ))}
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

buttonRow: {
    flexDirection: "row",
    marginTop: 12,
    justifyContent: "space-between",
},

spendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 6,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
},

spendText: {
    fontSize: 18,
    fontWeight: "700",
},
});