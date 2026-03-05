import { View, Text, StyleSheet } from "react-native";
import { ScrollView } from "react-native";
export default function Dashboard() {
// Generate days of a 31-day month
const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Split days into rows of 7
const calendarRows = [];
for (let i = 0; i < daysInMonth.length; i += 7) {
    calendarRows.push(daysInMonth.slice(i, i + 7));
}

return (
    <View style={styles.container}>
    {/* TOP HALF — Lime Section */}
    <View style={styles.topSection}>
        <Text style={styles.balanceLabel}>Total This Month</Text>
        <Text style={styles.balanceAmount}>$87.40</Text>
    </View>

    {/* MIDDLE — Categories */}
    <View style={styles.middleSection}>
        <Text style={styles.sectionTitle}>Spending Categories</Text>
        <View style={styles.categoryRow}><Text>☕ Fun</Text><Text>$12</Text></View>
        <View style={styles.categoryRow}><Text>🛒 Groceries</Text><Text>$30</Text></View>
        <View style={styles.categoryRow}><Text>🚗 Uber</Text><Text>$18</Text></View>
        <View style={styles.categoryRow}><Text>🍽 Dining</Text><Text>$27</Text></View>
    </View>

      {/* BOTTOM — Week Calendar */}
    <View style={styles.bottomSection}>
        <ScrollView> 
        <Text style={styles.sectionTitle}>March 2026</Text>

        {/* Weekday header */}
        <View style={styles.weekHeader}>
        {weekDays.map((day) => (
            <Text style={styles.day} key={day}>{day}</Text>
        ))}
        </View>

        {/* Calendar dates */}
        {calendarRows.map((week, index) => (
        <View style={styles.dateRow} key={index}>
            {week.map((date) => (
            <Text style={styles.date} key={date}>{date}</Text>
            ))}
            {/* Fill empty spots if last row has <7 days */}
            {week.length < 7 &&
            Array.from({ length: 7 - week.length }).map((_, i) => (
                <Text style={styles.date} key={`empty-${i}`}> </Text>
            ))}
        </View>
        ))}
        </ScrollView>
    </View>
    </View>
);
}

const styles = StyleSheet.create({
container: { flex: 1 },

/* TOP */
topSection: { flex: 2, backgroundColor: "#C7F36B", justifyContent: "center", alignItems: "center" },
balanceLabel: { fontSize: 18, color: "#333" },
balanceAmount: { fontSize: 40, fontWeight: "bold", marginTop: 10 },

/* MIDDLE */
middleSection: { flex: 1, padding: 20, backgroundColor: "white" },
sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
categoryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },

/* BOTTOM — Monthly Calendar */
bottomSection: { flex: 2, padding: 20, backgroundColor: "#f6f6f6" },
weekHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
dateRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
day: { fontWeight: "600", width: 40, textAlign: "center" },
date: { width: 40, textAlign: "center" },
});