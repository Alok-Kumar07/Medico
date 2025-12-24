// src/screens/VerifyScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  FlatList,
  Modal,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase';

// Example patients with current medicine (replace with Firestore data later)
const assignedPatients = [
  {
    id: '1',
    name: 'Alice Johnson',
    age: 70,
    doctor: 'Dr. Smith',
    currentMedicine: {
      name: 'Aspirin 75mg',
      relation: 'After Meal',
      photo: 'https://i.pinimg.com/736x/5f/2a/27/5f2a2756630109eff806d9d0016c8753.jpg',
    },
  },
  {
    id: '2',
    name: 'Bob Brown',
    age: 65,
    doctor: 'Dr. Adams',
    currentMedicine: {
      name: 'Metformin 500mg',
      relation: 'With Meal',
      photo: 'https://i.pinimg.com/736x/5f/2a/27/5f2a2756630109eff806d9d0016c8753.jpg',
    },
  },
  {
    id: '3',
    name: 'Charlie Green',
    age: 72,
    doctor: 'Dr. Adams',
    currentMedicine: {
      name: 'Vitamin D3',
      relation: 'Morning',
      photo: 'https://i.pinimg.com/736x/5f/2a/27/5f2a2756630109eff806d9d0016c8753.jpg',
    },
  },
];

export default function VerifyScreen({ navigation }) {
  const { profile } = useAuth();
  const caregiverName = profile?.name ?? 'Caregiver';

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Animated value for scroll
  const scrollY = new Animated.Value(0);

  // handle sign out
  const handleSignOut = async () => {
    try {
      if (auth && typeof auth.signOut === 'function') {
        await auth.signOut();
      } else {
        const { signOut: signOutFn } = require('firebase/auth');
        if (signOutFn) {
          await signOutFn(auth);
        } else {
          throw new Error('signOut not available');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to sign out: ' + err.message);
    }
  };

  const handleVerify = (patient, med) => {
    Alert.alert('Verified ✅', `${patient.name} has taken ${med.name}`);
  };

  const handleDecline = (patient, med) => {
    Alert.alert('Declined ❌', `Declined verification for ${patient.name}'s ${med.name}`);
  };

  const renderPatient = ({ item }) => (
    <View style={styles.patientCard}>
      {/* Patient Info */}
      <Text style={styles.patientName}>{item.name}</Text>
      <Text style={styles.patientDetails}>Age: {item.age}</Text>
      <Text style={styles.patientDetails}>Doctor: {item.doctor}</Text>

      {/* Medicine Info */}
      <View style={styles.medicineCard}>
        <TouchableOpacity onPress={() => setSelectedImage(item.currentMedicine.photo)}>
          <Image source={{ uri: item.currentMedicine.photo }} style={styles.medicineImg} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.medicineName}>{item.currentMedicine.name}</Text>
          <Text style={styles.medicineRelation}>{item.currentMedicine.relation}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.verifyBtn]}
          onPress={() => handleVerify(item, item.currentMedicine)}
        >
          <Text style={styles.btnText}>Verify ✅</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.declineBtn]}
          onPress={() => handleDecline(item, item.currentMedicine)}
        >
          <Text style={styles.btnText}>Decline ❌</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Interpolate scroll position into background color
  const headerBg = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: ['#ffffff', '#afe7aaff'], // from white to light-indigo
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* Animated Section Title */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg }]}>
        <Text style={styles.sectionTitle}>Verification Requests</Text>
      </Animated.View>

      <View style={styles.container}>
        <Animated.FlatList
          data={assignedPatients}
          keyExtractor={(item) => item.id}
          renderItem={renderPatient}
          contentContainerStyle={{ paddingBottom: 20, marginTop: 12 }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No assigned patients available for verification.</Text>
            </View>
          }
        />
      </View>

      {/* Popup Modal for Medicine Image */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedImage(null)}>
              <Icon name="x" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Image Preview */}
            <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ------------------- Styles -------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, paddingHorizontal: 16 },

  // Header Section
  header: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#111' },

  // Patient Card
  patientCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  patientName: { fontSize: 17, fontWeight: '700', marginBottom: 6, color: '#111' },
  patientDetails: { fontSize: 14, color: '#555', marginBottom: 2 },

  // Medicine
  medicineCard: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  medicineImg: { width: 70, height: 70, borderRadius: 10 },
  medicineName: { fontSize: 15, fontWeight: '600', color: '#111' },
  medicineRelation: { fontSize: 13, color: '#666', marginTop: 4 },

  // Actions
  actionRow: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  verifyBtn: { backgroundColor: '#10b981' },
  declineBtn: { backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10 },
  fullImage: { width: '90%', height: '80%', borderRadius: 12 },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
});
