import { View, Text, StyleSheet, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";


export default function Dashboard() {
const { token, amount, category } = useLocalSearchParams();
const { checkInResults, userProfile, monthlyBudget } = useAuth();

const [eventCounts, setEventCounts] = useState<{ [key: string]: number }>({});
const [loading, setLoading] = useState(true);

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth(); // 0 indexed

const firstDayOfMonth = new Date(year, month, 1).getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Compute actual spending per category from check-ins this month
const categoryTotals = useMemo(() => {
  const totals: Record<string, number> = {};
  checkInResults.forEach(r => {
    if (!r.visited) return;
    const d = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    totals[r.category] = (totals[r.category] ?? 0) + (r.amount ?? 0);
  });
  return totals;
}, [checkInResults, year, month]);

// All categories: profile categories first, then any check-in categories not in profile
const allCategories = useMemo(() => {
  const profileCats = userProfile?.categories ?? [];
  const checkinCats = Object.keys(categoryTotals).filter(c => !profileCats.includes(c));
  return [...profileCats, ...checkinCats];
}, [userProfile?.categories, categoryTotals]);

const totalSpent = Object.values(categoryTotals).reduce((s, v) => s + v, 0);


// Bump today’s event count when navigating here from a check-in
useEffect(() => {
    if (amount && category) {
        const todayStr = today.toISOString().split("T")[0];
        setEventCounts((prev) => ({
        ...prev,
        [todayStr]: (prev[todayStr] || 0) + 1,
        }));
    }
}, [amount, category]);

// Fetch Google events
useEffect(() => {
    if (!token) return;


    const fetchEvents = async () => {
    try {
        const now = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(now.getMonth() + 1);

        const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${nextMonth.toISOString()}&singleEvents=true&orderBy=startTime`,
        {
            headers: {
            Authorization: `Bearer ${token}`,
            },
        }
        );

        const data = await response.json();

        const counts: { [key: string]: number } = {};

        (data.items || []).forEach((event: any) => {
        const date =
            event.start?.dateTime?.split("T")[0] ||
            event.start?.date;

        if (!date) return;

        counts[date] = (counts[date] || 0) + 1;
        });

        setEventCounts(counts);
        setLoading(false);
    } catch (err) {
        console.log("Error fetching events:", err);
        setLoading(false);
    }
    };

    fetchEvents();
}, [token]);

// Build calendar grid
const buildCalendar = () => {
    const daysArray = [];

    // Empty spaces before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
    daysArray.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
    daysArray.push(day);
    }

    const rows = [];
    for (let i = 0; i < daysArray.length; i += 7) {
    rows.push(daysArray.slice(i, i + 7));
    }

    return rows;
};

const calendarRows = buildCalendar();

const getColor = (count: number) => {
    if (!count) return "#ffffff";

    const intensity = Math.min(count * 60, 255);
    return `rgb(${intensity}, 0, 0)`;
};




  return (
    <View style={styles.container}>

    {/* TOP — Summary */}
        <View style={styles.topSection}>
        <Text style={styles.balanceLabel}>Total This Month</Text>
        <Text style={styles.balanceAmount}>${totalSpent}</Text>

        <View style={styles.checkInButtonContainer}>
            <Text
            style={styles.checkInButton}
            onPress={() => router.push("/checkin")}
            >
            Check In
            </Text>
        </View>
        </View>

    {/* MIDDLE — Spending Categories */}
    <View style={styles.middleSection}>
        <Text style={styles.sectionTitle}>Spending Categories</Text>

        {allCategories.map(cat => (
        <View key={cat} style={styles.categoryRow}>
          <Text>{cat}</Text>
          <Text>${(categoryTotals[cat] ?? 0).toFixed(0)}</Text>
        </View>
        ))}

        <View style={styles.predictionBox}>
        <Text style={styles.predictionText}>
            Predicted Month End: ${totalSpent}
        </Text>
        </View>
    </View>

    {/* BOTTOM — Google Calendar Heatmap */}
    <View style={styles.bottomSection}>
        <ScrollView>
        <Text style={styles.sectionTitle}>
            {today.toLocaleString("default", { month: "long" })} {year}
        </Text>

        <View style={styles.weekHeader}>
            {weekDays.map((day) => (
            <Text style={styles.day} key={day}>
                {day}
            </Text>
            ))}
        </View>

        {calendarRows.map((week, i) => (
            <View style={styles.dateRow} key={i}>
            {week.map((day, index) => {
                if (!day)
                return <View style={styles.dateBox} key={index} />;

                const formattedDate = `${year}-${String(
                month + 1
                ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                const count = eventCounts[formattedDate];

                return (
                <View
                    key={index}
                    style={[
                    styles.dateBox,
                    { backgroundColor: getColor(count) },
                    ]}
                >
                    <Text>{day}</Text>
                </View>
                );
            })}
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
    topSection: {
        flex: 1,
        backgroundColor: "#C7F36B",
        justifyContent: "center",
        alignItems: "center",
    },

    checkInButtonContainer: {
        position: "absolute",
        bottom: -20,
        right: 20,
        },

        checkInButton: {
        backgroundColor: "black",
        color: "white",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        fontWeight: "600",
    },

    balanceLabel: { fontSize: 18, color: "#333" },
    balanceAmount: { fontSize: 36, fontWeight: "bold", marginTop: 8 },

    /* MIDDLE */
    middleSection: {
        flex: 1.5,
        padding: 20,
        backgroundColor: "white",
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 10,
    },

    categoryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 6,
    },

    predictionBox: {
        marginTop: 15,
        padding: 10,
        backgroundColor: "#f1f1f1",
        borderRadius: 8,
    },

    predictionText: {
        fontWeight: "600",
    },

    /* BOTTOM — Calendar */
    bottomSection: {
        flex: 2,
        padding: 20,
        backgroundColor: "#f6f6f6",
    },

    weekHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 6,
    },

    day: {
        flex: 1,
        textAlign: "center",
        fontWeight: "600",
    },

    dateRow: {
        flexDirection: "row",
        marginBottom: 4,
    },

    dateBox: {
        flex: 1,
        aspectRatio: 1,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 8,
        margin: 2,
    },
    });
