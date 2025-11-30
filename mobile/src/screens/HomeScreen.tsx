import React, { useEffect, useState, useCallback} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect} from '@react-navigation/native';
import { fetchEvents, joinEvent } from '../services/events';
import { EventResponse } from '../services/models/event_models';

type TabRole = 'organizer' | 'delegate' | 'volunteer';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<TabRole>('volunteer');
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const load = async (role: TabRole) => {
    try {
      setLoading(true);
      const data = await fetchEvents(role);
      setEvents(data);
    } catch (e: any) {
      Alert.alert('Load failed', e.message || 'Unable to fetch events');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(tab);

      return () => {
        console.log("Test for reloading events on navigation change");
      };
    }, [tab])
  );

  // Gonna add a feature here for reloading the screen once an event has been created
  

  useEffect(() => { load(tab); }, [tab]);

  const onCreate = () => {
    navigation.navigate('EditEvent' as never);
  };

  const openJoin = () => {
    setJoinModalVisible(true);
    setJoinCode('');
  };

  const onJoinConfirm = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Join failed', 'Enter a code');
      return;
    }
    try {
      setLoading(true);
      const ev = await joinEvent(code);
      Alert.alert('Joined', `Joined ${ev.name} as ${code === ev.delegate_join_code ? 'delegate' : 'volunteer'}`);
      setJoinModalVisible(false);
      // Refresh appropriate tab (delegate or volunteer based on backend role detection)
      load(tab);
    } catch (e: any) {
      Alert.alert('Join failed', e.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: EventResponse }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.date}>{new Date(item.start_date).toLocaleDateString()}</Text>
      </View>
      {item.location_name ? <Text style={styles.location}>{item.location_name}</Text> : null}
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      <View style={styles.actions}>
        {tab === 'organizer' ? (
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditEvent' as never, { event: item } as never)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.editButton, { marginLeft: 8, backgroundColor: '#4b5563' }]}
          onPress={() =>
            (navigation as any).navigate('EventDetail', {
              eventId: item._id ?? (item as any).id,
              role: tab,
            })
          }
        >
          <Text style={styles.editText}>Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        {['organizer','delegate','volunteer'].map(r => (
          <TouchableOpacity key={r} style={[styles.navItem, tab === r && styles.navItemActive]} onPress={() => setTab(r as TabRole)}>
            <Text style={[styles.navText, tab === r && styles.navTextActive]}>{r.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.actionRow}>        
        {tab === 'organizer' ? (
          <TouchableOpacity onPress={onCreate} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Create Event</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={openJoin} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Join by Code</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
      {!loading && events.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No {tab} events</Text>
          <Text style={styles.emptyHint}>{tab === 'organizer' ? 'Create your first event.' : 'Join an event using its code.'}</Text>
        </View>
      )}
      <FlatList
        data={events}
        keyExtractor={(e) => e._id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <Modal visible={joinModalVisible} transparent animationType="fade" onRequestClose={() => setJoinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Join Code</Text>
            <TextInput
              placeholder="ABC123"
              value={joinCode}
              onChangeText={setJoinCode}
              style={styles.modalInput}
              autoCapitalize="characters"
              maxLength={6}
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
  container: { flex: 1, backgroundColor: '#ecfdf5', padding: 12 },
  navbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, marginBottom: 12, borderBottomWidth: 2, borderColor: '#a7f3d0' },
  navItem: { paddingVertical: 6, paddingHorizontal: 10 },
  navItemActive: { borderBottomWidth: 3, borderColor: '#059669' },
  navText: { fontSize: 15, color: '#444' },
  navTextActive: { fontWeight: '700', color: '#059669' },
  actionRow: { alignItems: 'center', marginBottom: 12 },
  primaryAction: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  primaryActionText: { color: '#fff', fontWeight: '700' },
  emptyBox: { borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 24, alignItems: 'center', marginBottom: 12, backgroundColor: '#d1fae5' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#065f46' },
  emptyHint: { marginTop: 6, color: '#134e4a' },
  card: { borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#d1fae5' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  date: { fontSize: 12, color: '#666' },
  location: { marginTop: 6, color: '#134e4a' },
  description: { marginTop: 8, color: '#444' },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  editButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#2563eb', borderRadius: 6 },
  editText: { color: '#fff', fontWeight: '700' },
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
