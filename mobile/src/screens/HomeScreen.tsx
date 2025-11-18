import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const onCreate = () => {
    // Reuse existing EditEvent screen for creating a new event
    navigation.navigate('EditEvent' as never);
  };

  const openJoin = () => {
    setJoinModalVisible(true);
    setJoinCode('');
  };

  const onJoinConfirm = () => {
    // Placeholder: integrate with backend to validate/join using joinCode
    setJoinModalVisible(false);
    if (!joinCode.trim()) {
      Alert.alert('Join failed', 'Please enter a join code.');
      return;
    }
    // Demo success message — replace with real API call
    Alert.alert('Joined event', `Joined with code: ${joinCode.trim()}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.placeholderBox}>
        <Text style={styles.placeholderText}>No events yet</Text>
        <Text style={styles.hintText}>Events will appear here once created.</Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={onCreate} style={styles.createBtn} activeOpacity={0.8}>
          <Text style={styles.createBtnText}>Create Event</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openJoin} style={styles.joinBtn} activeOpacity={0.8}>
          <Text style={styles.joinBtnText}>Join Event</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={joinModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Join Event</Text>
            <TextInput
              placeholder="Enter join code"
              value={joinCode}
              onChangeText={setJoinCode}
              style={styles.modalInput}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onJoinConfirm} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderBox: {
    width: '90%',
    height: 240,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    padding: 12,
  },
  placeholderText: {
    fontSize: 18,
    color: '#444',
    fontWeight: '600',
  },
  hintText: {
    marginTop: 8,
    color: '#666'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  createBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  joinBtn: {
    backgroundColor: '#0ea5a4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  joinBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 10,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  modalCancelText: {
    color: '#444',
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  }
});
