import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchEvents } from '../services/events';
import { EventResponse } from '../services/models/event_models';

export default function EventsScreen() {
  const navigation = useNavigation();

  const [tab, setTab] = useState<'organizer' | 'delegate' | 'volunteer'>('volunteer');
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async (role: typeof tab, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const data = await fetchEvents(role);
      setEvents(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents(tab);
  }, [tab, loadEvents]);

  const onEdit = (event: EventResponse) => {
    // @ts-ignore
    navigation.navigate('EditEvent', { event } as never);
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
          <TouchableOpacity style={styles.editButton} onPress={() => onEdit(item)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
        {/* Details button - visible to all roles */}
        {/* @ts-ignore - navigation typing is generic here, passing params dynamically */}
        <TouchableOpacity
          style={[styles.editButton, { marginLeft: 8, backgroundColor: '#4b5563' }]}
          onPress={() => (navigation as any).navigate('EventDetail', { eventId: item._id, role: tab })}
        >
          <Text style={styles.editText}>Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.navbar}>
        {['organizer', 'delegate', 'volunteer'].map(role => (
          <TouchableOpacity
          key = {role}
          style={[
            styles.navItem,
            tab === role && styles.navItemActive
          ]}
          onPress={() => setTab(role as any)}
          >
            <Text style={[styles.navText, tab === role && styles.navTextActive]}>
              {role.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading && !refreshing ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(i) => i._id ?? (i as any).id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadEvents(tab, true)} />
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 24, color: '#555' }}>
              No events yet for this role.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    padding: 12
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderColor: '#a7f3d0'
  },
  navItem: {
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  navItemActive: {
    borderBottomWidth: 3,
    borderColor: '#059669'
  },
  navText: {
    fontSize: 15,
    color: '#444'
  },
  navTextActive: {
    fontWeight: '700',
    color: '#059669'
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 12,
    textAlign: 'center',
    color: '#065f46'
  },
  card: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#d1fae5'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  date: {
    fontSize: 12,
    color: '#666'
  },
  location: {
    marginTop: 6,
    color: '#134e4a'
  },
  description: {
    marginTop: 8,
    color: '#444'
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    borderRadius: 6
  },
  editText: {
    color: '#fff',
    fontWeight: '700'
  }
  ,
  joinButton: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: '#2563eb',
  borderRadius: 6,
},
  joinText: {
  color: '#fff',
  fontWeight: '700'
},
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#d33',
    borderRadius: 6
  }
});
