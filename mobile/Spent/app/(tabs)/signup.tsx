import { Link } from "expo-router";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { useState } from "react";

export default function SignUp() {
const [name, setName] = useState("");

return (
    <View style={styles.container}>
    
    {/* Lime Top Section */}
    <View style={styles.topSection}>
        <Text style={styles.title}>Welcome to Spent</Text>
    </View>

    {/* White Form Section */}
    <View style={styles.formSection}>
        <Text style={styles.label}>Your Name</Text>

        <TextInput
        placeholder="Enter your name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholderTextColor="#888"
        />

        <Link href="/dashboard" asChild>
        <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
        </Link>
    </View>
    </View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "white" },

/* Lime Header */
topSection: {
    flex: 1,
    backgroundColor: "#C7F36B",
    justifyContent: "center",
    alignItems: "center",
},

title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#333",
},

/* Form Area */
formSection: {
    flex: 2,
    padding: 30,
    justifyContent: "center",
},

label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
},

input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 14,
    borderRadius: 12,
    marginBottom: 25,
    fontSize: 16,
},

button: {
    backgroundColor: "#C7F36B",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
},

buttonText: {
    fontWeight: "600",
    fontSize: 16,
    color: "#333",
},
});