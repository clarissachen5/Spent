import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

export default function NameScreen() {
  const [name, setName] = useState("");
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Your Name</Text>
      <TextInput
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholderTextColor="#888"
      />
      <Pressable
        style={styles.button}
        onPress={() => router.replace("/dashboard")}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 14, borderRadius: 12, marginBottom: 25, fontSize: 16, width: "80%" },
  button: { backgroundColor: "#C7F36B", padding: 15, borderRadius: 14, alignItems: "center", width: "80%" },
  buttonText: { fontWeight: "600", fontSize: 16, color: "#333" },
});