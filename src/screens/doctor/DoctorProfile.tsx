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
  ScrollView,
  Pressable,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// A reusable component for editable profile fields
const EditableField = ({ label, value, onSave, isEditing, setIsEditing, placeholder }) => {
    const [currentValue, setCurrentValue] = useState(value);
  
    useEffect(() => {
      setCurrentValue(value);
    }, [value]);
  
    const handleSave = () => {
      onSave(currentValue);
      setIsEditing(false);
    };

  
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldValueContainer}>
          {isEditing ? (
            <TextInput
              style={styles.fieldInput}
              value={currentValue}
              onChangeText={setCurrentValue}
              placeholder={placeholder}
              autoFocus
              onBlur={handleSave} // Save when the input loses focus
            />
          ) : (
            <Text style={[styles.fieldValue, !value && styles.fieldPlaceholder]}>
              {value || placeholder}
            </Text>
          )}
          <TouchableOpacity style={styles.editButton} onPress={() => isEditing ? handleSave() : setIsEditing(true)}>
            <Text style={styles.editButtonText}>{isEditing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

export default function DoctorProfile({ navigation }) {
    const { profile, user } = useAuth();
  
    const handleSignOut = async () => {
        try {
          await auth().signOut();
        } catch (error) {
          console.error('Sign out error:', error);
          Alert.alert('Error', 'Failed to sign out.');
        }
      };
    // State for profile data
    const [doctorProfile, setDoctorProfile] = useState({
        name: profile?.name ?? 'Doctor',
        photoURL: profile?.photoURL ?? "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
        specialty: profile?.specialty ?? '',
        qualifications: profile?.qualifications ?? '',
        clinicAddress: profile?.clinicAddress ?? '',
    });
  
    // State for editing modes
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingSpecialty, setIsEditingSpecialty] = useState(false);
    const [isEditingQualifications, setIsEditingQualifications] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);

    const [isUpdating, setIsUpdating] = useState(false); // For photo upload spinner
  
    // State for patient list
    const [patients, setPatients] = useState([]);
    const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  
    // Effect to sync local state with auth profile from useAuth hook
    useEffect(() => {
        if (profile) {
            setDoctorProfile({
                name: profile.name ?? "Doctor",
                photoURL: profile.photoURL ?? "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                specialty: profile.specialty ?? '',
                qualifications: profile.qualifications ?? '',
                clinicAddress: profile.clinicAddress ?? '',
            });
        }
    }, [profile]);
  
    // Effect to fetch assigned patients from Firestore
    useEffect(() => {
      if (!user) {
        setIsLoadingPatients(false);
        return;
      }
      const subscriber = firestore()
        .collection('users')
        .where('approvedDoctor', '==', user.uid)
        .onSnapshot(querySnapshot => {
          const patientList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          setPatients(patientList);
          setIsLoadingPatients(false);
        }, error => {
          console.error("Failed to fetch patients:", error);
          setIsLoadingPatients(false);
        });
        
      return () => subscriber();
    }, [user]);

    // Generic function to update a field in Firestore
    const updateProfileField = async (field, value) => {
        if (!user || !value.trim()) return;
        
        try {
            await firestore().collection('users').doc(user.uid).update({ [field]: value.trim() });
            Alert.alert('Success', `${field} has been updated.`);
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            Alert.alert('Error', `Failed to update ${field}.`);
        }
    };
  
    const handleUpdatePhoto = async () => {
      if (!user) return;
      launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, async (response) => {
        if (response.didCancel || !response.assets?.[0]?.uri) return;
        
        const imageUri = response.assets[0].uri;
        setIsUpdating(true); // Start loading spinner on the photo
  
        const fileName = `${user.uid}_profile_${Date.now()}.jpg`;
        const storageRef = storage().ref(`users/${user.uid}/${fileName}`);
  
        try {
          await storageRef.putFile(imageUri);
          const downloadURL = await storageRef.getDownloadURL();
          await updateProfileField('photoURL', downloadURL);
          setDoctorProfile(prev => ({ ...prev, photoURL: downloadURL })); // Update local state immediately
        } catch (error) {
          console.error("Error updating photo:", error);
          Alert.alert('Error', 'Failed to update profile photo.');
        } finally {
          setIsUpdating(false); // Stop loading spinner
        }
      });
    };
  
    const renderPatient = ({ item }) => (
      <TouchableOpacity
        style={styles.patientCard}
        onPress={() => navigation.navigate('DoctorPatientProfile', { patientId: item.id })}
      >
        <Image source={{ uri: item.profileImg || 'https://i.pravatar.cc/150?img=5' }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName}>{item.name}</Text>
          <Text style={styles.patientDetails}>Age: {item.age}</Text>
        </View>
      </TouchableOpacity>
    );
  
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <FlatList
            ListHeaderComponent={
              <ScrollView>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleUpdatePhoto} disabled={isUpdating}>
                        <Image source={{ uri: doctorProfile.photoURL }} style={styles.profileImg} />
                        {isUpdating && <ActivityIndicator style={styles.photoLoader} size="large" color="#fff" />}
                    </TouchableOpacity>
                    <Text style={styles.email}>{user?.email}</Text>
                </View>

                <View style={styles.detailsSection}>
                    <EditableField label="Full Name" value={doctorProfile.name} onSave={(val) => updateProfileField('name', val)} isEditing={isEditingName} setIsEditing={setIsEditingName} placeholder="Enter your full name" />
                    <EditableField label="Specialty" value={doctorProfile.specialty} onSave={(val) => updateProfileField('specialty', val)} isEditing={isEditingSpecialty} setIsEditing={setIsEditingSpecialty} placeholder="e.g., Cardiologist" />
                    <EditableField label="Qualifications" value={doctorProfile.qualifications} onSave={(val) => updateProfileField('qualifications', val)} isEditing={isEditingQualifications} setIsEditing={setIsEditingQualifications} placeholder="e.g., MD, MBBS" />
                    <EditableField label="Clinic / Hospital Address" value={doctorProfile.clinicAddress} onSave={(val) => updateProfileField('clinicAddress', val)} isEditing={isEditingAddress} setIsEditing={setIsEditingAddress} placeholder="Enter your work address" />
                </View>
                
                <View style={styles.patientListSection}>
                    <Text style={styles.sectionTitle}>Assigned Patients</Text>
                    {isLoadingPatients && <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }}/>}
                </View>
              </ScrollView>
            }
            data={patients}
            renderItem={renderPatient}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={ !isLoadingPatients && <Text style={styles.emptyText}>No patients assigned yet.</Text> }
          />
        </KeyboardAvoidingView>

        <Pressable style={styles.btn} onPress={handleSignOut}>
                    <Text style={styles.btnText}>Sign Out</Text>
                </Pressable>
      </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fff" },
    header: { alignItems: "center", padding: 20, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    profileImg: { width: 120, height: 120, borderRadius: 60, marginBottom: 12, borderWidth: 3, borderColor: "#2563eb" },
    photoLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 60 },
    email: { fontSize: 16, color: "#64748b", marginTop: 4 },
    detailsSection: { padding: 20 },
    fieldContainer: { marginBottom: 18 },
    fieldLabel: { fontSize: 14, color: '#94a3b8', marginBottom: 4 },
    fieldValueContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
    fieldValue: { fontSize: 16, color: '#1e293b', flex: 1 },
    fieldPlaceholder: { fontStyle: 'italic', color: '#9ca3af' },
    fieldInput: { fontSize: 16, color: '#1e293b', flex: 1, paddingVertical: 0 }, // Removed padding for better alignment
    editButton: { padding: 4, marginLeft: 10 },
    editButtonText: { color: '#2563eb', fontWeight: '600' },
    patientListSection: { paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 12, marginBottom: 16, color: "#111" },
    patientCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 14, borderRadius: 12, marginBottom: 12, marginHorizontal: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    patientName: { fontSize: 16, fontWeight: "600", color: "#111" },
    patientDetails: { fontSize: 13, color: "#555" },
    emptyText: { textAlign: "center", color: "#666", marginTop: 40, fontSize: 15 },
    btn: {
    backgroundColor: "#ef4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

