import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

export default function CaregiverHome({ navigation }) {
  const { profile, user } = useAuth();
  const caregiverName = profile?.name ?? 'Caregiver';
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // --- Start of Async Fetch Function ---
    const fetchPatientsAndDoctors = async () => {
      setLoading(true);
      try {
        const querySnapshot = await firestore()
          .collection('users')
          .where('approvedCaregivers', 'array-contains', user.uid)
          .get();

        const patientListPromises = querySnapshot.docs.map(async doc => {
          const patientData = {
            id: doc.id,
            ...doc.data(),
            doctorName: 'N/A', // Default value
          };

          // 1. Fetch Doctor Name if available
          if (patientData.approvedDoctor) {
            const doctorDoc = await firestore().collection('users').doc(patientData.approvedDoctor).get();
            if (doctorDoc.exists) {
              patientData.doctorName = doctorDoc.data().name || 'Unnamed Doctor';
            } else {
              patientData.doctorName = 'Doctor not found';
            }
          }

          return patientData;
        });

        const patientList = await Promise.all(patientListPromises);
        setPatients(patientList);
        setLoading(false);

      } catch (error) {
        console.error("Failed to fetch patients:", error);
        Alert.alert("Error", "Could not load patient information.");
        setLoading(false);
      }
    };

    // NOTE: You cannot use a real-time `onSnapshot` with async/await inside, 
    // so we switch to a one-time `get()` for the initial load.
    // For real-time updates, a more complex setup involving promises in `onSnapshot` is needed.
    fetchPatientsAndDoctors();
    // For simplicity and to correctly fetch doctor data, we use a one-time fetch (`get()`) here.

  }, [user]);
  // --- End of Async Fetch Function ---

  const handleSignOut = async () => {
    try {
      await auth().signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      Alert.alert('Error', 'Failed to sign out: ' + err.message);
    }
  };

  const renderPatient = ({ item }) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => navigation.navigate('CaregiverPatienteProfile', { patientId: item.id })}
    >
      <Image source={{ uri: item.profileImg || 'https://i.pravatar.cc/150?img=5' }} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.patientName}>{item.name}</Text>
        <Text style={styles.patientDetails}>Age: {item.age}</Text>
        {/* ✅ ADDED: Display the fetched doctorName */}
        <Text style={styles.patientDetails}>Doctor: {item.doctorName}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greet}>Hi, <Text style={styles.bold}>{caregiverName}</Text></Text>
          <TouchableOpacity onPress={() => setShowProfileMenu(true)}>
            <Image
              source={{ uri: profile?.photoURL ?? 'https://i.pravatar.cc/150?img=10' }}
              style={styles.profileImg}
            />
          </TouchableOpacity>
        </View>

        {/* Assigned Patients Section */}
        <Text style={styles.sectionTitle}>Assigned Patients</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 30 }} />
        ) : patients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No patients assigned.</Text>
            <Text style={styles.emptySubText}>Send a request from the 'Add Patient' screen.</Text>
          </View>
        ) : (
          <FlatList
            data={patients}
            renderItem={renderPatient}
            keyExtractor={item => item.id}
          />
        )}

        {/* Profile Menu (modal) */}
        <Modal visible={showProfileMenu} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalName}>{caregiverName}</Text>
              <Pressable
                style={styles.modalBtn}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('CaregiverProfile');
                }}
              >
                <Text style={styles.modalBtnText}>View Profile</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                onPress={async () => {
                  setShowProfileMenu(false);
                  await handleSignOut();
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Sign Out</Text>
              </Pressable>
              <Pressable style={styles.modalClose} onPress={() => setShowProfileMenu(false)}>
                <Text style={{ color: '#666' }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greet: { fontSize: 18, color: '#333' },
  bold: { fontWeight: '700' },
  profileImg: { width: 50, height: 50, borderRadius: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  patientCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, marginBottom: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  patientName: { fontSize: 16, fontWeight: '600' },
  patientDetails: { fontSize: 13, color: '#555' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  emptySubText: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  modalName: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalBtn: { padding: 12, borderRadius: 10, backgroundColor: '#eef2ff', marginBottom: 8, alignItems: 'center' },
  modalBtnText: { color: '#2563eb', fontWeight: '700' },
  modalClose: { marginTop: 8, alignItems: 'center' },
});