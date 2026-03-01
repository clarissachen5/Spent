import { View, Text, StyleSheet, ScrollView } from "react-native";

export default function Dashboard() {
return (
    <ScrollView style={styles.container}>
    <Text style={styles.header}>Welcome to Spent</Text>

    <View style={styles.card}>
        <Text style={styles.cardTitle}>Predicted Spending</Text>
        <Text>$245 This Week</Text>
    </View>

    <View style={styles.card}>
        <Text style={styles.cardTitle}>Fake Calendar</Text>
        <FakeCalendar />
    </View>
    </ScrollView>
);
}

function FakeCalendar() {
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

return (
    <View style={{ marginTop: 10 }}>
    {days.map((day, index) => (
        <Text key={index}>{day} - $ {Math.floor(Math.random() * 50)}</Text>
    ))}
    </View>
);
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    header: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
    card: {
        backgroundColor: "#f2f2f2",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
});