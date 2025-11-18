import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';

export default function EventDetailScreen() {
  const route = useRoute();
  // event passed from navigation
  // @ts-ignore
  const event = route?.params?.event ?? null;
  // @ts-ignore
  const role: 'admin' | 'volunteer' = route?.params?.role ?? 'volunteer';

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>No event data</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Host</Text>
        <Text style={styles.boxValue}>{String(event.host ?? 'Unknown')}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>When</Text>
        <Text style={styles.boxValue}>{String(event.date ?? event.time ?? '')}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Location</Text>
        <Text style={styles.boxValue}>{String(event.location ?? event.address ?? '')}</Text>
      </View>

      <View style={styles.box}>
        <Text style={styles.boxLabel}>Private Event</Text>
        <Text style={styles.boxValue}>{event.is_private || event.isPrivate ? 'Yes' : 'No'}</Text>
      </View>

      {role === 'admin' && (
        <>
          <View style={styles.box}>
            <Text style={styles.boxLabel}>Attendees</Text>
            {event.attendees && event.attendees.length ? (
              event.attendees.map((a: any) => (
                <Text key={String(a)} style={styles.listItem}>- {String(a)}</Text>
              ))
            ) : (
              <Text style={styles.boxValue}>No attendees</Text>
            )}
          </View>

          <View style={styles.box}>
            <Text style={styles.boxLabel}>Volunteers</Text>
            {event.tasks && event.tasks.length ? (
              event.tasks.map((t: any) => (
                <Text key={t.id} style={styles.listItem}>- {t.title}{t.assignedTo ? ` (Assigned: ${t.assignedTo})` : ''}</Text>
              ))
            ) : event.volunteers && event.volunteers.length ? (
              event.volunteers.map((v: any) => (
                <Text key={String(v)} style={styles.listItem}>- {String(v)}</Text>
              ))
            ) : (
              <Text style={styles.boxValue}>No volunteers</Text>
            )}
          </View>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff'
  },
  header: {
    fontSize: 18,
    textAlign: 'center'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  box: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa'
  },
  boxLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6
  },
  boxValue: {
    fontSize: 16,
    color: '#222'
  },
  listItem: {
    fontSize: 14,
    color: '#333'
  }
});
