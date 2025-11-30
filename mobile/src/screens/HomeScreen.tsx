import React, { useEffect, useState, useCallback} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect} from '@react-navigation/native';
import {
  fetchEvents,
  registerDelegate,
  joinViaDelegateCode,
  fetchDelegateProfile,
  attachDelegateToEvent,
  fetchVolunteerProfile,
  leaveVolunteerGroup,
  removeVolunteer,
} from '../services/events';
import { EventResponse, DelegateProfile, VolunteerProfile } from '../services/models/event_models';

type TabRole = 'organizer' | 'delegate' | 'volunteer';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabRole>('volunteer');
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [delegateEventId, setDelegateEventId] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [profile, setProfile] = useState<DelegateProfile | null>(null);
  const [volProfile, setVolProfile] = useState<VolunteerProfile | null>(null);
  const [attachEventId, setAttachEventId] = useState('');

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
  useEffect(() => {
    const loadProfile = async () => {
      if (tab !== 'delegate') return;
      try {
        const prof = await fetchDelegateProfile();
        setProfile(prof);
      } catch (e) {
        // ignore if not a delegate yet
      }
    };
    loadProfile();
  }, [tab]);

  useEffect(() => {
    const loadVolProfile = async () => {
      if (tab !== 'volunteer') return;
      try {
        const prof = await fetchVolunteerProfile();
        setVolProfile(prof);
      } catch (e) {
        // ignore if not joined yet
      }
    };
    loadVolProfile();
  }, [tab]);

  const onCreate = () => {
    navigation.navigate('EditEvent' as never);
  };

  const openJoin = () => {
    setJoinModalVisible(true);
    setJoinCode('');
    setOrgName('');
    setDelegateEventId('');
    setIssuedCode(null);
  };

  const onJoinConfirm = async () => {
    try {
      setLoading(true);
      if (tab === 'delegate') {
        if (!orgName.trim()) {
          Alert.alert('Missing info', 'Enter organization name.');
          return;
        }
        const res = await registerDelegate(delegateEventId.trim() || null, orgName.trim());
        setIssuedCode(res.delegate_org_code);
        setJoinModalVisible(false);
        const prof = await fetchDelegateProfile();
        setProfile(prof);
        Alert.alert('Delegate registered', `Org code issued: ${res.delegate_org_code}${res.event_id ? ` for event ${res.event_id}` : ''}`);
      } else {
        const code = joinCode.trim().toUpperCase();
        if (!code) {
          Alert.alert('Join failed', 'Enter an org code');
          return;
        }
        const res = await joinViaDelegateCode(code);
        Alert.alert('Joined', 'Joined via delegate org code');
        const vp = await fetchVolunteerProfile();
        setVolProfile(vp);
        setJoinModalVisible(false);
      }
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
        ) : tab === 'delegate' ? (
          profile ? null : (
            <TouchableOpacity onPress={openJoin} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Register as Delegate</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity onPress={openJoin} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Join with Org Code</Text>
          </TouchableOpacity>
        )}
      </View>
      {tab === 'delegate' && profile && (
        <View style={styles.profileCard}>
          <Text style={styles.modalTitle}>Delegate Profile</Text>
          <Text style={styles.modalLabel}>Name</Text>
          <Text style={styles.profileValue}>{profile.name || profile.email}</Text>
          <Text style={styles.modalLabel}>Organization</Text>
          <Text style={styles.profileValue}>{profile.organization || 'N/A'}</Text>
          <Text style={styles.modalLabel}>Org Code</Text>
          <Text style={[styles.profileValue, { fontWeight: '700' }]}>{profile.delegate_org_code}</Text>
          {(!profile.event_id || profile.event_id === 'null') && (
            <>
              <Text style={[styles.modalLabel, { marginTop: 8 }]}>Enter event code to join</Text>
              <TextInput
                placeholder="Event ID or delegate event code"
                value={attachEventId}
                onChangeText={setAttachEventId}
                style={[styles.modalInput, { marginBottom: 8 }]}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={async () => {
                  if (!attachEventId.trim()) {
                    Alert.alert('Missing event', 'Enter an event ID or code');
                    return;
                  }
                  try {
                    setLoading(true);
                    await attachDelegateToEvent(attachEventId.trim(), profile.delegate_org_code);
                    const refreshed = await fetchDelegateProfile();
                    setProfile(refreshed);
                    Alert.alert('Attached', 'Delegate linked to event');
                  } catch (e: any) {
                    Alert.alert('Attach failed', e?.message ?? 'Unable to attach to event');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.primaryActionText}>Join Event</Text>
              </TouchableOpacity>
            </>
        )}
        <Text style={styles.modalLabel}>Volunteers ({profile.volunteer_count})</Text>
        {profile.volunteers.length === 0 ? (
          <Text style={styles.profileValue}>None yet</Text>
        ) : (
          profile.volunteers.map((v, idx) => (
            <View key={v.email || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.profileValue}>
                {v.email || 'Unknown'} {v.organization ? `(${v.organization})` : ''}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setLoading(true);
                    await removeVolunteer(v.email || '');
                    const refreshed = await fetchDelegateProfile();
                    setProfile(refreshed);
                    Alert.alert('Removed', 'Volunteer removed');
                  } catch (e: any) {
                    Alert.alert('Remove failed', e?.message ?? 'Unable to remove');
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ color: '#b91c1c', fontWeight: '700' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    )}
      {tab === 'volunteer' && volProfile && (
        <View style={styles.profileCard}>
          <Text style={styles.modalTitle}>My Group</Text>
          <Text style={styles.modalLabel}>Delegate</Text>
          <Text style={[styles.profileValue, { fontWeight: '700' }]}>{volProfile.delegate_email || 'Unknown'}</Text>
          <Text style={styles.modalLabel}>Organization</Text>
          <Text style={styles.profileValue}>{volProfile.organization || 'N/A'}</Text>
          <Text style={styles.modalLabel}>Org Code</Text>
          <Text style={[styles.profileValue, { fontWeight: '700' }]}>{volProfile.delegate_org_code}</Text>
          <Text style={styles.modalLabel}>Volunteers ({volProfile.volunteer_count})</Text>
          {volProfile.volunteers.length === 0 ? (
            <Text style={styles.profileValue}>None yet</Text>
          ) : (
            <>
              <Text style={[styles.profileValue, { fontWeight: '700' }]}>
                {volProfile.delegate_email || 'Delegate'}
              </Text>
              {volProfile.volunteers.map((v, idx) => (
                <Text key={v.email || idx} style={styles.profileValue}>
                  {v.email || 'Unknown'} {v.organization ? `(${v.organization})` : ''}
                </Text>
              ))}
            </>
          )}
          <TouchableOpacity
            style={[styles.primaryAction, { marginTop: 8 }]}
            onPress={async () => {
              try {
                setLoading(true);
                await leaveVolunteerGroup();
                setVolProfile(null);
                Alert.alert('Left group', 'You have left the group.');
              } catch (e: any) {
                Alert.alert('Leave failed', e?.message ?? 'Unable to leave');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Text style={styles.primaryActionText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
      {!loading && events.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No {tab} events</Text>
          <Text style={styles.emptyHint}>
            {tab === 'organizer'
              ? 'Create your first event.'
              : tab === 'delegate'
              ? 'Register as a delegate to get your org code.'
              : 'Join with your delegate’s org code.'}
          </Text>
        </View>
      )}
      <FlatList
        data={events}
        keyExtractor={(e) => e._id ?? (e as any).id ?? `${e.name}-${e.start_date}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <Modal visible={joinModalVisible} transparent animationType="fade" onRequestClose={() => setJoinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {tab === 'delegate' ? 'Register as Delegate' : 'Join with Org Code'}
            </Text>
            {tab === 'delegate' ? (
              <>
                <Text style={styles.modalLabel}>Event ID (optional)</Text>
                <TextInput
                  placeholder="Event ID or leave blank for now"
                  value={delegateEventId}
                  onChangeText={setDelegateEventId}
                  style={styles.modalInput}
                  autoCapitalize="none"
                />
                <Text style={styles.modalLabel}>Organization</Text>
                <TextInput
                  placeholder="Organization name"
                  value={orgName}
                  onChangeText={setOrgName}
                  style={styles.modalInput}
                  autoCapitalize="words"
                />
                {issuedCode ? (
                  <Text style={[styles.modalLabel, { marginTop: 8 }]}>
                    Issued code: <Text style={{ fontWeight: '700' }}>{issuedCode}</Text>
                  </Text>
                ) : null}
              </>
            ) : (
              <TextInput
                placeholder="Org code (e.g. ABC123)"
                value={joinCode}
                onChangeText={setJoinCode}
                style={styles.modalInput}
                autoCapitalize="characters"
                maxLength={6}
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onJoinConfirm} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>{tab === 'delegate' ? 'Register' : 'Join'}</Text>
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
  modalLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
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
  },
  profileValue: {
    fontSize: 16,
    color: '#111',
    marginBottom: 8,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#f0fdf4',
    marginBottom: 12,
  }
});
