import { View, Text, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import Slider from "@react-native-community/slider";

export default function Dashboard() {
  const { token, amount, category } = useLocalSearchParams();

  const [eventCounts, setEventCounts] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = 2026;
  const month = 2; // March
  const today = new Date(year, month, 1);

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


  const [spending, setSpending] = useState({
    Fun: 12,
    Groceries: 30,
    Uber: 18,
    Dining: 27,
  });

  // total automatically updates whenever spending changes
  const totalSpent = Object.values(spending).reduce((sum, val) => sum + val, 0);

  // update spending from check-in page
  useEffect(() => {
    if (amount && category) {
      const numericAmount = Number(amount);

      if (!isNaN(numericAmount)) {
        setSpending((prev) => ({
          ...prev,
          [category as string]:
            (prev[category as keyof typeof prev] || 0) + numericAmount,
        }));

        const todayStr = today.toISOString().split("T")[0];

        setEventCounts((prev) => ({
          ...prev,
          [todayStr]: (prev[todayStr] || 0) + 1,
        }));
      }
    }
  }, [amount, category]);

  const parseEvents = (items: any[]) => {
          const grouped: { [date: string]: Array<any> } = {};
          items.forEach((event: any) => {
            let dateStr = "";
            if (event.start?.date) {
              dateStr = event.start.date;
            } else if (event.start?.dateTime) {
              dateStr = event.start.dateTime.split("T")[0];
            }
            if (dateStr) {
              if (!grouped[dateStr]) grouped[dateStr] = [];
              grouped[dateStr].push({
                title: event.summary || "",
                description: event.description || "",
                location: event.location || "",
                start: event.start,
                end: event.end,
              });
            }
          });
          return grouped;
        };

      // Send events to backend for analysis
  const sendEventsToBackend = async (groupedEvents: any) => {
    try {
      const response = await fetch("http://10.239.5.18:8000/ollama/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: groupedEvents }),
      });
      const result = await response.json();
      console.log("Ollama result:", JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("Error sending events to backend:", err);
    }
  };


  // fetch Google calendar events
  useEffect(() => {
    if (!token) {
      setError("No Google token provided. Please sign in again.");
      setLoading(false);
      return;
    }


    const fetchEvents = async () => {
      try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${monthStart.toISOString()}&timeMax=${monthEnd.toISOString()}&singleEvents=true&orderBy=startTime`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error("Failed to fetch events. Invalid or expired token.");
        }

        const counts: { [key: string]: number } = {};
        const groupedEvents = parseEvents(data.items || []);

        (data.items || []).forEach((event: any) => {
          let dateStr = "";

          if (event.start?.date) {
            dateStr = event.start.date;
          } else if (event.start?.dateTime) {
            dateStr = event.start.dateTime.split("T")[0];
          }

          if (dateStr) {
            counts[dateStr] = (counts[dateStr] || 0) + 1;
          }
        });

        setEventCounts(counts);
        setLoading(false);
        sendEventsToBackend(groupedEvents);
      } catch (err: any) {
        setError(err.message || "Error fetching events.");
        setLoading(false);
      }
    };

    fetchEvents();
  }, [token]);

  const buildCalendar = () => {
    const daysArray = [];

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
      <View style={styles.topSection}>
        <Text style={styles.balanceLabel}>Total This Month</Text>
        <Text style={styles.balanceAmount}>${totalSpent}</Text>

        <View style={styles.checkInButtonContainer}>
          <Text
            style={styles.checkInButton}
            onPress={() =>
              router.push({
                pathname: "/checkin",
                params: { token },
              })
            }
          >
            Check In
          </Text>
        </View>
      </View>

      <View style={styles.middleSection}>
        <Text style={styles.sectionTitle}>Spending Categories</Text>

        {Object.entries(spending).map(([category, value]) => {
          const colors: Record<string, string> = {
            Fun: "#FDE68A",
            Groceries: "#BBF7D0",
            Uber: "#BFDBFE",
            Dining: "#FBCFE8",
          };

          return (
            <View
              key={category}
              style={[
                styles.categoryCard,
                { backgroundColor: colors[category] || "#eee" },
              ]}
            >
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{category}</Text>
                <Text style={styles.categoryAmount}>${value}</Text>
              </View>

              <Slider
                minimumValue={0}
                maximumValue={100}
                value={value}
                disabled={true}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.bottomSection}>
        {loading && <Text>Loading events...</Text>}
        {error && <Text style={{ color: "red" }}>{error}</Text>}

        <View style={styles.weekHeader}>
          {weekDays.map((day) => (
            <Text key={day} style={styles.day}>
              {day}
            </Text>
          ))}
        </View>

        {calendarRows.map((row, i) => (
          <View key={i} style={styles.dateRow}>
            {row.map((day, j) => {
              if (!day) return <View key={j} style={styles.dateBox} />;

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const count = eventCounts[dateStr] || 0;

              return (
                <View
                  key={j}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topSection: {
    flex: 1,
    backgroundColor: "#C7F36B",
    justifyContent: "center",
    alignItems: "center",
  },

  checkInButtonContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
  },

  checkInButton: {
    backgroundColor: "#f9ebcc",
    color: "#C7F36B",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontWeight: "600",
    overflow: "hidden",
  },

  balanceLabel: { fontSize: 18, color: "#333" },
  balanceAmount: { fontSize: 36, fontWeight: "bold", marginTop: 8 },

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

  categoryCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },

  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  categoryName: {
    fontSize: 16,
    fontWeight: "600",
  },

  categoryAmount: {
    fontSize: 16,
    fontWeight: "700",
  },

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
