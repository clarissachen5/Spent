import { View, Text, StyleSheet, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";


export default function Dashboard() {
  const { token, amount, category } = useLocalSearchParams();

  const [eventCounts, setEventCounts] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = 2026;
  const month = 2; // March (0-indexed)
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

  const totalSpent =
      spending.Fun +
      spending.Groceries +
      spending.Uber +
      spending.Dining;


  // Add new spend from check-in
  useEffect(() => {
      if (amount && category) {
          const numericAmount = Number(amount);

          setSpending((prev) => ({
          ...prev,
          [category as string]:
              (prev[category as keyof typeof prev] || 0) + numericAmount,
          }));

          // ALSO increase today’s event count
          const todayStr = today.toISOString().split("T")[0];

          setEventCounts((prev) => ({
          ...prev,
          [todayStr]: (prev[todayStr] || 0) + 1,
          }));
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
      const response = await fetch("http://localhost:8000/ollama/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: groupedEvents }),
      });
      const result = await response.json();
      console.log("AI API result:", result);
      // Handle result as needed
    } catch (err) {
      console.error("Error sending events to backend:", err);
    }
  };


  // Fetch Google events
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
        
        console.log("Successfully fetched events. Parsing response...");
        const data = await response.json();
        if (!response.ok) {
          throw new Error("Failed to fetch events. Invalid or expired token.");
        }
        console.log("Raw API response:", data);
        const counts: { [key: string]: number } = {};
        const groupedEvents = parseEvents(data.items || []);

        (data.items || []).forEach((event: any, idx: number) => {
          let dateStr = "";
          console.log(`[${idx}] Raw event:`, event);

          if (event.start?.date) {
            console.log(`[${idx}] Found event.start.date:`, event.start.date);

            // Check if it's already in YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(event.start.date)) {
              dateStr = event.start.date;
              console.log(`[${idx}] Date is ISO format:`, dateStr);
            } else {
              // Parse "Monday, March 23, 2026"
              const match = event.start.date.match(/^[A-Za-z]+,\s([A-Za-z]+)\s(\d{1,2}),\s(\d{4})$/);
              if (match) {
                const monthNames = {
                  January: "01",
                  February: "02",
                  March: "03",
                  April: "04",
                  May: "05",
                  June: "06",
                  July: "07",
                  August: "08",
                  September: "09",
                  October: "10",
                  November: "11",
                  December: "12",
                };
                const month = monthNames[match[1] as keyof typeof monthNames];
                const day = match[2].padStart(2, "0");
                const year = match[3];
                dateStr = `${year}-${month}-${day}`;
                console.log(`[${idx}] Parsed human-readable date:`, dateStr);
              } else {
                console.log(`[${idx}] Could not parse human-readable date:`, event.start.date);
              }
            }
          } else if (event.start?.dateTime) {
            dateStr = event.start.dateTime.split("T")[0];
            console.log(`[${idx}] Found event.start.dateTime:`, event.start.dateTime, "->", dateStr);
          } else {
            console.log(`[${idx}] No recognizable date in event.start`);
          }

          if (dateStr) {
            counts[dateStr] = (counts[dateStr] || 0) + 1;
          }
        });

        console.log("Fetched eventCounts:", counts);

        setEventCounts(counts);
        setLoading(false);
        sendEventsToBackend(groupedEvents);
      } catch (err: any) {
        setError(err.message || "Error fetching events.");
        setLoading(false);
      }
    };
    console.log("Starting to fetch events with token:", token);
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
      <View style={styles.topSection}>
        <Text style={styles.balanceLabel}>Total This Month</Text>
        <Text style={styles.balanceAmount}>${totalSpent}</Text>
        <View style={styles.checkInButtonContainer}></View>
        <View style={styles.checkInButtonContainer}>
          <Text
            style={styles.checkInButton}
            onPress={() =>
              router.push({
                pathname: "/checkin",
                params: { token },
              })
            }>
            Check In
          </Text>
        </View>
      </View>
      <View style={styles.middleSection}>
        <Text style={styles.sectionTitle}>Spending Categories</Text>
        <View style={styles.categoryRow}>
          <Text>Fun: ${spending.Fun}</Text>
          <Text>Groceries: ${spending.Groceries}</Text>
        </View>
        <View style={styles.categoryRow}>
          <Text>Uber: ${spending.Uber}</Text>
          <Text>Dining: ${spending.Dining}</Text>
        </View>
      </View>
      <View style={styles.bottomSection}>
        {loading && <Text>Loading events...</Text>}
        {error && <Text style={{ color: "red" }}>{error}</Text>}
        <View style={styles.weekHeader}>
          {weekDays.map((day) => (
            <Text key={day} style={styles.day}>{day}</Text>
          ))}
        </View>
        {calendarRows.map((row, i) => (
          <View key={i} style={styles.dateRow}>
            {row.map((day, j) => {
              if (!day) return <View key={j} style={styles.dateBox} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const count = eventCounts[dateStr] || 0;
              console.log("Rendering date:", dateStr, "Count:", count, "EventCounts:", eventCounts);
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
