import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import firestore from '@react-native-firebase/firestore';

export default function DoctorHomeScreen({ navigation }) {
  const { profile, user } = useAuth();
  const doctorName = profile?.name ?? 'Doctor';

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all patients who have approved this doctor
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const subscriber = firestore()
      .collection('users')
      // Query for documents where the 'approvedDoctor' field matches the current doctor's UID
      .where('approvedDoctor', '==', user.uid)
      .onSnapshot(querySnapshot => {
        const patientList = [];
        querySnapshot.forEach(doc => {
          patientList.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        setPatients(patientList);
        setLoading(false);
      }, error => {
        console.error("Failed to fetch patients:", error);
        Alert.alert("Error", "Could not load patient list.");
        setLoading(false);
      });

    return () => subscriber();
  }, [user]);

  
  const renderPatient = ({ item }) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => navigation.navigate('DoctorPatientProfile', { patientId: item.id })}
    >
      <Image 
        source={{ uri: item.profileImg || 'https://i.pravatar.cc/150?img=5' }} 
        style={styles.avatar} 
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.patientName}>{item.name}</Text>
        <Text style={styles.patientDetails}>Age: {item.age} | {item.gender}</Text>
        <Text style={styles.patientDetails}>Patient ID: {item.patientId}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
            <View>
                <Text style={styles.greet}>Welcome,</Text>
                <Text style={styles.bold}>Dr. {doctorName}</Text>
            </View>
            {/* --- MODIFICATION: Wrapped Image in TouchableOpacity for navigation --- */}
            <TouchableOpacity onPress={() => navigation.navigate('DoctorProfile')}>
                <Image 
                    source={{ uri: profile?.photoURL || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} 
                    style={styles.profileImg} 
                />
            </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your Patients</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 30 }} />
        ) : (
          <FlatList
            data={patients}
            renderItem={renderPatient}
            keyExtractor={item => item.id}
            ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>You have no patients assigned.</Text>
                    <Text style={styles.emptySubText}>Use the 'Add Patient' screen to send requests.</Text>
                </View>
            )}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 16 },
  header: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20 
  },
  greet: { fontSize: 20, color: '#333' },
  bold: { fontSize: 24, fontWeight: '700', color: '#111' },
  profileImg: { width: 50, height: 50, borderRadius: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10, color: '#333' },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  patientName: { fontSize: 16, fontWeight: '600' },
  patientDetails: { fontSize: 13, color: '#555', marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  emptySubText: { fontSize: 14, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
});

