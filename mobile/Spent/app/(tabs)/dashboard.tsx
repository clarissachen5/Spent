import { View, Text, StyleSheet } from "react-native";

export default function Dashboard() {
  return (
    <View style={styles.container}>
      {/* TOP HALF — Lime Section */}
      <View style={styles.topSection}>
        <Text style={styles.balanceLabel}>Total This Week</Text>
        <Text style={styles.balanceAmount}>$87.40</Text>
      </View>

      {/* MIDDLE — Categories */}
      <View style={styles.middleSection}>
        <Text style={styles.sectionTitle}>Spending Categories</Text>
        <View style={styles.categoryRow}><Text>☕ Coffee</Text><Text>$12</Text></View>
        <View style={styles.categoryRow}><Text>🛒 Groceries</Text><Text>$30</Text></View>
        <View style={styles.categoryRow}><Text>🚗 Uber</Text><Text>$18</Text></View>
        <View style={styles.categoryRow}><Text>🍽 Dining</Text><Text>$27</Text></View>
      </View>

      {/* BOTTOM — Week Calendar */}
      <View style={styles.bottomSection}>
        <Text style={styles.sectionTitle}>Upcoming Week</Text>
        <View style={styles.calendarRow}>
          <Text style={styles.day}>Mon</Text>
          <Text style={styles.day}>Tue</Text>
          <Text style={styles.day}>Wed</Text>
          <Text style={styles.day}>Thu</Text>
          <Text style={styles.day}>Fri</Text>
          <Text style={styles.day}>Sat</Text>
          <Text style={styles.day}>Sun</Text>
        </View>
        <View style={styles.dateRow}>
          <Text style={styles.date}>4</Text>
          <Text style={styles.date}>5</Text>
          <Text style={styles.date}>6</Text>
          <Text style={styles.date}>7</Text>
          <Text style={styles.date}>8</Text>
          <Text style={styles.date}>9</Text>
          <Text style={styles.date}>10</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSection: { flex: 2, backgroundColor: "#C7F36B", justifyContent: "center", alignItems: "center" },
  balanceLabel: { fontSize: 18, color: "#333" },
  balanceAmount: { fontSize: 40, fontWeight: "bold", marginTop: 10 },
  middleSection: { flex: 1, padding: 20, backgroundColor: "white" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  bottomSection: { flex: 1, padding: 20, backgroundColor: "#f6f6f6" },
  calendarRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  dateRow: { flexDirection: "row", justifyContent: "space-between" },
  day: { fontWeight: "600" },
  date: { fontSize: 16 },
});
