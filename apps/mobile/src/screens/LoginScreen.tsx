import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GatorGather</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder=""
        placeholderTextColor="#666"
        returnKeyType="next"
        blurOnSubmit
        // uncontrolled: no value/onChangeText
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder=""
        placeholderTextColor="#666"
        returnKeyType="done"
        // uncontrolled: no value/onChangeText
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#ffffff"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    color: "#22884C"
  },
  label: {
    fontSize: 14,
    opacity: 0.9,
    color: "#000000"
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: "#000000",
    borderColor: "#00000022"
  }
});
