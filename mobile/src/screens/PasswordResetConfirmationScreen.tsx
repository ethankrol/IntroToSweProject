import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function PasswordResetConfirmationScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Password Changed!</Text>
      <Text style={styles.subtitle}>Your password has been successfully updated.</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.buttonText}>Go to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, color: '#007AFF' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});