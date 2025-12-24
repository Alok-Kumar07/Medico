import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';

export default function CaregiverProfile({ navigation }) {
  const { profile, user } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // State for profile data
  const [caregiverName, setCaregiverName] = useState(profile?.name ?? "Caregiver");
  const [caregiverPhoto, setCaregiverPhoto] = useState(profile?.photoURL ?? "https://i.pravatar.cc/150?img=10");

  // State for patient list and loading status
  const [patients, setPatients] = useState([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  // useEffect to update profile info when it loads
  useEffect(() => {
    if (profile) {
      setCaregiverName(profile.name ?? "Caregiver");
      setCaregiverPhoto(profile.photoURL ?? "https://i.photoURL.cc/150?img=10");
    }
  }, [profile]);

  // --- ✅ UPDATED: useEffect to fetch patients AND their doctors ---
  useEffect(() => {
    if (!user) {
      setIsLoadingPatients(false);
      return;
    }

    setIsLoadingPatients(true);

    // Fetch patients in real-time, then resolve doctor names
    const subscriber = firestore()
      .collection('users')
      .where('approvedCaregivers', 'array-contains', user.uid)
      .onSnapshot(async (querySnapshot) => {
        try {
          const patientPromises = querySnapshot.docs.map(async doc => {
            const patientData = { id: doc.id, ...doc.data() };

            // --- Look up Doctor's Name ---
            if (patientData.approvedDoctor) {
              try {
                const doctorDoc = await firestore().collection('users').doc(patientData.approvedDoctor).get();
                patientData.doctorName = doctorDoc.exists
                  ? doctorDoc.data().name || "Unnamed Doctor"
                  : "Doctor Not Found";
              } catch (e) {
                console.warn(`Failed to fetch doctor ${patientData.approvedDoctor}:`, e);
                patientData.doctorName = "Error Fetching Doctor";
              }
            } else {
              patientData.doctorName = "Not Assigned";
            }

            return patientData;
          });

          // Wait for all doctor lookups to complete
          const patientListWithDoctors = await Promise.all(patientPromises);

          setPatients(patientListWithDoctors);
          setIsLoadingPatients(false);

        } catch (error) {
          console.error("Failed to process patient data:", error);
          Alert.alert("Error", "Could not fully load patient data.");
          setIsLoadingPatients(false);
        }
      }, error => {
        console.error("Firestore error:", error);
        Alert.alert("Error", "Could not load patient information.");
        setIsLoadingPatients(false);
      });

    // Unsubscribe when component unmounts
    return () => subscriber();
  }, [user]);

  const caregiverEmail = profile?.email ?? "caregiver@email.com";

  // (handleUpdateName and handleUpdatePhoto functions remain the same)
  const handleUpdateName = async () => {
    if (!user) return;
    if (caregiverName.trim() === '' || caregiverName.trim() === profile?.name) {
      setEditingName(false);
      return;
    }
    setIsUpdating(true);
    try {
      await firestore().collection('users').doc(user.uid).update({
        name: caregiverName.trim(),
      });
      Alert.alert('Success', 'Your name has been updated.');
    } catch (error) {
      console.error("Error updating name:", error);
      Alert.alert('Error', 'Failed to update your name.');
      setCaregiverName(profile?.name);
    } finally {
      setIsUpdating(false);
      setEditingName(false);
    }
  };

  const handleUpdatePhoto = async () => {
    if (!user) return;
    launchImageLibrary({ mediaType: 'photo' }, async (response) => {
      if (response.didCancel || !response.assets?.[0]?.uri) return;
      if (response.errorCode) {
        Alert.alert('Error', 'Image picker error: ' + response.errorMessage);
        return;
      }
      const imageUri = response.assets[0].uri;
      setIsUpdating(true);
      setCaregiverPhoto(imageUri);
      const fileName = `${user.uid}_${Date.now()}.jpg`;
      const storageRef = storage().ref(`users/${user.uid}/${fileName}`);
      try {
        await storageRef.putFile(imageUri);
        const downloadURL = await storageRef.getDownloadURL();
        await firestore().collection('users').doc(user.uid).update({
          photoURL: downloadURL,
        });
        Alert.alert('Success', 'Your profile photo has been updated.');
      } catch (error) {
        console.error("Error updating photo:", error);
        Alert.alert('Error', 'Failed to update profile photo.');
        setCaregiverPhoto(profile?.photoURL);
      } finally {
        setIsUpdating(false);
      }
    });
  };

  const handleEditSavePress = () => {
    if (editingName) {
      handleUpdateName();
    } else {
      setEditingName(true);
    }
  };

  // --- ✅ UPDATED: renderPatient function to display doctorName ---
  const renderPatient = ({ item }) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => navigation.navigate('CaregiverPatienteProfile', { patientId: item.id })}
    >
      <Image source={{ uri: item.profileImg || 'https://i.pravatar.cc/150?img=5' }} style={styles.avatar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.patientName}>{item.name}</Text>
        <Text style={styles.patientDetails}>Age: {item.age || 'N/A'}</Text>
        <Text style={styles.patientDetails}>Doctor: Dr.{item.doctorName || 'N/A'}</Text>
        <Text style={styles.patientDetails}>Blood Group: {item.bloodGroup || 'N/A'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ListHeaderComponent={
            <View style={styles.header}>
              <TouchableOpacity onPress={handleUpdatePhoto} disabled={isUpdating}>
                <Image source={{ uri: caregiverPhoto }} style={styles.profileImg} />
                {isUpdating && <ActivityIndicator style={styles.photoLoader} size="large" color="#fff" />}
              </TouchableOpacity>
              <View style={styles.nameContainer}>
                {editingName ? (
                  <TextInput
                    style={styles.nameInput}
                    value={caregiverName}
                    onChangeText={setCaregiverName}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.name}>{caregiverName}</Text>
                )}
                <TouchableOpacity style={styles.editButton} onPress={handleEditSavePress}>
                  <Text style={styles.editButtonText}>{editingName ? 'Save' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.email}>{caregiverEmail}</Text>
              <Text style={styles.sectionTitle}>Patients Under Care</Text>
              {/* Show loading indicator for patient list */}
              {isLoadingPatients && <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }} />}
            </View>
          }
          data={patients} // Use real patient data
          renderItem={renderPatient}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            // Only show this if not loading
            !isLoadingPatients && <Text style={styles.emptyText}>No patients assigned yet.</Text>
          }
          contentContainerStyle={patients.length === 0 && !isLoadingPatients && { flex: 1 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10, },
  profileImg: { width: 120, height: 120, borderRadius: 60, marginBottom: 12, borderWidth: 3, borderColor: "#2563eb", },
  photoLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 60, },
  nameContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6, },
  name: { fontSize: 22, fontWeight: "700", color: "#111", textAlign: "center", },
  nameInput: { fontSize: 22, fontWeight: "700", borderBottomWidth: 1.5, borderColor: "#2563eb", textAlign: "center", paddingVertical: 4, minWidth: '50%', },
  editButton: { marginLeft: 10, padding: 6, },
  editButtonText: { color: '#2563eb', fontWeight: '600', },
  email: { fontSize: 14, color: "#666", marginBottom: 20, },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12, marginBottom: 16, alignSelf: "flex-start", color: "#111", },
  patientCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 12, marginHorizontal: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3, },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  patientName: { fontSize: 16, fontWeight: "600", color: "#111", marginBottom: 4, },
  patientDetails: { fontSize: 13, color: "#555", marginBottom: 2, },
  emptyText: { textAlign: "center", color: "#666", marginTop: 40, fontSize: 15, },
});