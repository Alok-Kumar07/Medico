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
import { useAuth } from '../../hooks/useAuth';
import firestore from '@react-native-firebase/firestore';

export default function DoctorAddPatientScreen() {
  const [searchId, setSearchId] = useState('');
  const [foundPatient, setFoundPatient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // Get the currently logged-in doctor's user and profile info
  const { user, profile } = useAuth();

  const handleSearch = async () => {
    if (!searchId.trim()) {
      Alert.alert('Invalid ID', 'Please enter a Patient ID to search.');
      return;
    }
    setIsSearching(true);
    setFoundPatient(null);
    try {
      // Query the 'users' collection for a document where 'patientId' matches the search query.
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
        // Store the patient's document ID (uid) along with their data
        setFoundPatient({ uid: patientDoc.id, ...patientDoc.data() });
      }
    } catch (error) {
      console.error("Search failed:", error);
      Alert.alert('Error', 'An error occurred while searching for the patient.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRequestPatient = async (patient) => {
    if (!user || !profile) {
      Alert.alert("Authentication Error", "Could not identify the doctor. Please log in again.");
      return;
    }
    setIsRequesting(true);
    try {
      // Create a new notification in the patient's "notifications" sub-collection
      await firestore()
        .collection('users')
        .doc(patient.uid) // Use the patient's actual document ID
        .collection('notifications')
        .add({
          type: 'doctor_request', // Differentiates this from a caregiver request
          fromId: user.uid, // The Doctor's UID
          fromName: profile.name || 'A Doctor', // The Doctor's name
          status: 'pending',
          timestamp: firestore.FieldValue.serverTimestamp(),
        });

      setShowModal(false);
      Alert.alert('Request Sent ✅', `Your request to add ${patient.name} has been sent for approval.`);
      setFoundPatient(null); // Clear search result after sending request
      setSearchId('');
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
            placeholderTextColor="#9ca3af"
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
            <Image 
              source={{ uri: foundPatient.profileImg || "https://i.pinimg.com/564x/f1/0f/f7/f10ff70a7155e5ab666bcdd1b45b726d.jpg" }} 
              style={styles.avatar} 
            />
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
                  <Text style={styles.modalInfo}>Blood Group: {foundPatient.bloodGroup}</Text>
                  <Text style={styles.modalInfo}>Gender: {foundPatient.gender}</Text>

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
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
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
