import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function CheckIn() {
    const locations = [
        { name: "Starbucks", category: "Dining" },
        { name: "Whole Foods", category: "Groceries" },
        { name: "Uber", category: "Uber" },
    ];

    const spendOptions = [
        { label: "Cheapest ($0–10)", value: 10, color: "#D8B4F8" },     // lilac
        { label: "Moderate ($10–15)", value: 15, color: "#C7F36B" },    // lime
        { label: "Expensive ($15–25+)", value: 25, color: "#f96868" },  // pastel red
    ];

    const handleSpend = (location: any, amount: number) => {
        //changed from push to replae because we want to replace the current screen with the dashboard after check-in instead of stacking it on top
        router.replace({
        pathname: "/",
        params: {
            location: location.name,
            category: location.category,
            amount,
        },
        });
    };

    return (
        <View style={styles.container}>
        <Text style={styles.title}>Where are you?</Text>

        {locations.map((location) => (
            <View key={location.name} style={styles.card}>
            <Text style={styles.locationTitle}>{location.name}</Text>

            {spendOptions.map((option) => (
                <TouchableOpacity
                key={option.label}
                style={[styles.spendButton, { backgroundColor: option.color }]}
                onPress={() => handleSpend(location, option.value)}
                >
                <Text style={styles.spendText}>{option.label}</Text>
                </TouchableOpacity>
            ))}
            </View>
        ))}
        </View>
    );
    }

    const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "white" },
    title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },

    card: {
        padding: 15,
        backgroundColor: "#f4f4f4",
        borderRadius: 12,
        marginBottom: 20,
    },

    locationTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 10,
    },

    spendButton: {
        backgroundColor: "black",
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
    },

    spendText: {
        textAlign: "center", fontWeight: "600",
    },
});