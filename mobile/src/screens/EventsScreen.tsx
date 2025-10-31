import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

type Task = { id: string; title: string; assignedTo?: string };

type Event = {
  id: string;
  title: string;
  date: string;
  location: string;
  description?: string;
  tasks?: Task[];
};

const MOCK_EVENTS: Event[] = [
  {
    id: '1',
    title: 'Community Clean-up',
    date: '2025-11-01',
    location: 'City Park',
    description: 'Join volunteers to clean up the park and plant new trees.'
    ,
    tasks: [
      { id: '1t1', title: 'Bring trash bags', assignedTo: 'volunteer1' },
      { id: '1t2', title: 'Arrange tools', assignedTo: 'volunteer2' }
    ]
  },
  {
    id: '2',
    title: 'Food Drive',
    date: '2025-11-15',
    location: 'Town Hall',
    description: 'Collect and sort donations for local food banks.'
    ,
    tasks: [
      { id: '2t1', title: 'Set up collection boxes', assignedTo: 'volunteer3' },
      { id: '2t2', title: 'Coordinate drop-offs', assignedTo: 'volunteer4' }
    ]
  },
  {
    id: '3',
    title: 'Charity Run',
    date: '2025-12-05',
    location: 'Riverside Trail',
    description: '5K run to raise funds for youth programs.',
    // example tasks for admin/volunteer
    // tasks are objects with id, title, assignedTo(optional)
    tasks: [
      { id: 't1', title: 'Set up water stations', assignedTo: 'volunteerA' },
      { id: 't2', title: 'Coordinate volunteers', assignedTo: 'volunteerB' }
    ]
  }
];



export default function EventsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // route.params may be undefined in nav typing; read initial role if provided
  // initialize local role state so the user can continue regardless of backend role
  // @ts-ignore
  const initialRole: 'admin' | 'volunteer' = route?.params?.role ?? 'volunteer';

  const [role, setRole] = useState<'admin' | 'volunteer'>(initialRole);
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);

  const onEdit = (event: Event) => {
    // navigate to EditEvent screen, passing the event
    // @ts-ignore
    navigation.navigate('EditEvent', { event } as never);
  };

  const toggleRole = () => setRole((r) => (r === 'admin' ? 'volunteer' : 'admin'));

  const onJoin = (event: Event) => {
    // Placeholder: in real app call backend to join
    Alert.alert('Joined', `You joined ${event.title}`);
  };

  const onCancelTask = (eventId: string, taskId: string) => {
    Alert.alert('Cancel task', 'Are you sure you want to cancel this task?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: () => {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === eventId ? { ...e, tasks: e.tasks?.filter((t) => t.id !== taskId) } : e
            )
          );
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Event }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>
      <Text style={styles.location}>{item.location}</Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      <View style={styles.actions}>
        {role === 'admin' ? (
          <TouchableOpacity style={styles.editButton} onPress={() => onEdit(item)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <Button title="Join" onPress={() => onJoin(item)} />
        )}
        {/* Details button - visible to all roles */}
        {/* @ts-ignore - navigation typing is generic here, passing params dynamically */}
        <TouchableOpacity style={[styles.editButton, { marginLeft: 8, backgroundColor: '#4b5563' }]} onPress={() => (navigation as any).navigate('EventDetail', { event: item, role })}>
          <Text style={styles.editText}>Details</Text>
        </TouchableOpacity>
      </View>

      {/* Tasks list */}
      {item.tasks && item.tasks.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Tasks</Text>
          {item.tasks.map((task) => (
            <View key={task.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ flex: 1 }}>{task.title}</Text>
              {role === 'admin' ? (
                <TouchableOpacity style={styles.cancelButton} onPress={() => onCancelTask(item.id, task.id)}>
                  <Text style={{ color: '#fff' }}>Cancel</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: '#666' }}>{task.assignedTo ? `Assigned: ${task.assignedTo}` : ''}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={styles.header}>Events</Text>
        <TouchableOpacity onPress={toggleRole} style={{ marginRight: 8 }}>
          <Text style={{ color: '#2563eb' }}>Switch to {role === 'admin' ? 'volunteer' : 'admin'}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={events}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 12,
    textAlign: 'center'
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa'
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
    color: '#333'
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
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#d33',
    borderRadius: 6
  }
});
