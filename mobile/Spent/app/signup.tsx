import { Link } from "expo-router";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useState } from "react";

export default function SignUp() {
  const [name, setName] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />
      <Link href="/(tabs)/dashboard">
        <Text style={styles.button}>Continue</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 28, marginBottom: 20 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 20,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#4CAF50",
    color: "white",
    padding: 12,
    borderRadius: 8,
    textAlign: "center",
    width: "100%",
  },
});

