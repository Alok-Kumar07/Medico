import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import firestore from '@react-native-firebase/firestore';

export default function AddPatientScreen() {
  const [searchId, setSearchId] = useState('');
  const [foundPatient, setFoundPatient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const { user, profile } = useAuth(); // Get current caregiver user and profile
  const navigation = useNavigation();

  const handleSearch = async () => {
    if (!searchId.trim()) {
      Alert.alert('Invalid ID', 'Please enter a patient ID to search.');
      return;
    }
    setIsSearching(true);
    setFoundPatient(null);
    try {
      const querySnapshot = await firestore()
        .collection('users')
        .where('patientId', '==', searchId.trim().toUpperCase())
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        Alert.alert('Not Found', 'No patient found with that ID.');
        setFoundPatient(null);
      } else {
        const patientDoc = querySnapshot.docs[0];
        // --- MODIFICATION: Store the document ID (uid) along with the data ---
        setFoundPatient({ uid: patientDoc.id, ...patientDoc.data() });
      }
    } catch (error) {
      console.error("Search failed:", error);
      Alert.alert('Error', 'An error occurred while searching for the patient.');
    } finally {
      setIsSearching(false);
    }
  };

  // --- MODIFICATION: Logic to send a request to the patient ---
  const handleRequestPatient = async (patient) => {
    if (!user || !profile) {
      Alert.alert("Error", "Could not identify caregiver. Please log in again.");
      return;
    }
    setIsRequesting(true);
    try {
      // Create a notification in the patient's "notifications" sub-collection
      await firestore()
        .collection('users')
        .doc(patient.uid) // Use the patient's actual UID
        .collection('notifications')
        .add({
          type: 'caretaker_request',
          fromId: user.uid, // Caregiver's UID
          fromName: profile.name || 'A Caregiver', // Caregiver's name
          status: 'pending',
          timestamp: firestore.FieldValue.serverTimestamp(),
        });

      setShowModal(false);
      Alert.alert('Request Sent ✅', `Your request to add ${patient.name} has been sent.`);
    } catch (error) {
      console.error("Request failed:", error);
      Alert.alert("Error", "Could not send the request. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Enter Patient ID"
            value={searchId}
            onChangeText={setSearchId}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={isSearching}>
            {isSearching ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Search</Text>}
          </TouchableOpacity>
        </View>

        {foundPatient && (
          <TouchableOpacity style={styles.patientCard} onPress={() => setShowModal(true)}>
            <Image source={{ uri: foundPatient.profileImg || "https://i.pinimg.com/564x/f1/0f/f7/f10ff70a7155e5ab666bcdd1b45b726d.jpg" }} style={styles.avatar} />
            <View>
              <Text style={styles.patientName}>{foundPatient.name || 'N/A'}</Text>
              <Text style={styles.patientInfo}>ID: {foundPatient.patientId}</Text>
            </View>
          </TouchableOpacity>
        )}

        <Modal visible={showModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {foundPatient && (
                <>
                  <Image source={{ uri: foundPatient.profileImg || "https://i.pinimg.com/564x/f1/0f/f7/f10ff70a7155e5ab666bcdd1b45b726d.jpg" }} style={styles.modalAvatar} />
                  <Text style={styles.modalName}>{foundPatient.name}</Text>
                  <Text style={styles.modalInfo}>Age: {foundPatient.age}</Text>
                  <Text style={styles.modalInfo}>Doctor: {foundPatient.doctor || 'N/A'}</Text>
                  <Text style={styles.modalInfo}>Blood Group: {foundPatient.bloodGroup}</Text>
                  <Text style={styles.modalInfo}>Gender: {foundPatient.gender}</Text>
                  <Text style={styles.modalInfo}>Problem: {foundPatient.problem || 'Not specified'}</Text>

                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: '#2563eb' }]}
                    onPress={() => handleRequestPatient(foundPatient)}
                    disabled={isRequesting}
                  >
                    {isRequesting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Request to Add</Text>}
                  </Pressable>

                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: '#f3f4f6' }]}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={[styles.modalBtnText, { color: '#111' }]}>Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 16 },
  searchBox: { flexDirection: 'row', marginBottom: 20 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: '#2563eb',
    marginLeft: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    elevation: 2,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  patientName: { fontSize: 16, fontWeight: '700', color: '#111' },
  patientInfo: { fontSize: 14, color: '#555' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
  modalAvatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  modalName: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  modalInfo: { fontSize: 14, color: '#444', marginBottom: 4 },
  modalBtn: { padding: 12, borderRadius: 10, marginTop: 10, width: '100%', alignItems: 'center' },
  modalBtnText: { fontWeight: '700' },
});
