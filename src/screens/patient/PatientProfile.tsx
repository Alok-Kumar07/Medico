import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Platform,
  PermissionsAndroid,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../hooks/useAuth";
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Feather';
// --- FIREBASE IMPORTS ---
import firestore from "@react-native-firebase/firestore";
import storage from '@react-native-firebase/storage';

// --- OPTIONS CONSTANTS ---
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Function to generate a random alphanumeric ID
const generatePatientId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

const PatientProfile = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  // --- STATE MANAGEMENT ---
  const [profileData, setProfileData] = useState(null);
  const [reports, setReports] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdown, setDropdown] = useState({ visible: false, field: null, options: [] });
  const [caretakerName, setCaretakerName] = useState("Not Assigned");
  const [doctorName, setDoctorName] = useState("Not Assigned");

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    bloodGroup: "",
  });

  // --- DATA FETCHING EFFECT (PROFILE) ---
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const subscriber = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(async (documentSnapshot) => {
        if (documentSnapshot.exists) {
          const data = documentSnapshot.data();

          // --- MODIFICATION: Check for Patient ID ---
          // If patientId doesn't exist, create and save one.
          if (!data.patientId) {
            const newPatientId = generatePatientId();
            try {
              await firestore().collection('users').doc(user.uid).update({
                patientId: newPatientId,
              });
              data.patientId = newPatientId; // Add to local data immediately
            } catch (error) {
              console.error("Failed to create patient ID:", error);
            }
          }
          // --- END MODIFICATION ---

          setProfileData({ ...data, email: user.email });
          setFormData({
            name: data.name || "",
            age: data.age || "",
            gender: data.gender || "",
            bloodGroup: data.bloodGroup || "",
          });
        } else {
          // Handle case where user document doesn't exist yet
          const newPatientId = generatePatientId();
          const initialProfile = {
            email: user.email,
            patientId: newPatientId,
            name: '',
            age: '',
            gender: '',
            bloodGroup: '',
          };
          // Create the document with the essential ID
          await firestore().collection('users').doc(user.uid).set(initialProfile, { merge: true });
          setProfileData(initialProfile);
        }
        setLoading(false);
      }, error => {
        console.error("Failed to fetch profile:", error);
        Alert.alert("Error", "Could not load profile data.");
        setLoading(false);
      });
    return () => subscriber();
  }, [user]);

  // ✨ NEW: Data Fetching Effect for Reports
  useEffect(() => {
    if (!user) return;

    const reportsSubscriber = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('reports')
      .orderBy('createdAt', 'desc') // Show newest reports first
      .onSnapshot(querySnapshot => {
        const reportsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setReports(reportsList);
      }, error => {
        console.error("Failed to fetch reports:", error);
        Alert.alert("Error", "Could not load reports data.");
      });

    return () => reportsSubscriber();
  }, [user]);

  // --- ✨ 2. ADD NEW EFFECT TO FETCH CARETAKER'S NAME ---
  useEffect(() => {
    const fetchCaretakerName = async () => {
      // Check if profile data and the approvedCaregivers array exist and have content
      if (profileData && profileData.approvedCaregivers && profileData.approvedCaregivers.length > 0) {
        // We'll display the first approved caregiver.
        const caregiverId = profileData.approvedCaregivers[0];
        try {
          const caregiverDoc = await firestore().collection('users').doc(caregiverId).get();
          if (caregiverDoc.exists) {
            setCaretakerName(caregiverDoc.data().name || "Unnamed Caregiver");
          } else {
            setCaretakerName("Caregiver not found");
          }
        } catch (error) {
          console.error("Failed to fetch caregiver name:", error);
          setCaretakerName("Error loading name");
        }
      } else {
        setCaretakerName("Not Assigned");
      }
    };

    fetchCaretakerName();
  }, [profileData]); // This effect runs whenever your profileData is updated

  // --- ✨ 2. ADD NEW EFFECT TO FETCH DOCTOR'S NAME ---
  useEffect(() => {
    const fetchDoctorName = async () => {
      // Check if profile data and the approvedDoctor field exist
      if (profileData && profileData.approvedDoctor) {
        const doctorId = profileData.approvedDoctor;
        try {
          const doctorDoc = await firestore().collection('users').doc(doctorId).get();
          if (doctorDoc.exists) {
            setDoctorName(doctorDoc.data().name || "Unnamed Doctor");
          } else {
            setDoctorName("Doctor not found");
          }
        } catch (error) {
          console.error("Failed to fetch doctor name:", error);
          setDoctorName("Error loading name");
        }
      } else {
        setDoctorName("Not Assigned");
      }
    };
    fetchDoctorName();
  }, [profileData]);

  // --- NEW: HANDLER TO REMOVE DOCTOR ---
  const handleRemoveDoctor = () => {
    if (!profileData.approvedDoctor) {
      Alert.alert("No Doctor Assigned", "You don't currently have an approved doctor to remove.");
      return;
    }

    Alert.alert(
      "Remove Approved Doctor",
      `Are you sure you want to remove Dr. ${doctorName}? This will immediately revoke their access to your health data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              // Crucial step: Remove the approvedDoctor field from the patient's document.
              await firestore().collection('users').doc(user.uid).update({
                approvedDoctor: firestore.FieldValue.delete(),
              });
              Alert.alert("Success", "The doctor has been removed and their access revoked.");
            } catch (error) {
              console.error("Failed to remove doctor:", error);
              Alert.alert("Error", "Could not remove the doctor. Please try again.");
            }
          },
        },
      ]
    );
  };

  // --- ✨ NEW: HANDLER TO REMOVE CARETAKER ---
  const handleRemoveCaretaker = () => {
    const caregiverIdToRemove = profileData?.approvedCaregivers?.[0];

    if (!caregiverIdToRemove) {
      Alert.alert("No Caretaker Assigned", "You don't currently have an approved caretaker to remove.");
      return;
    }

    Alert.alert(
      "Remove Approved Caretaker",
      `Are you sure you want to remove ${caretakerName}? This will immediately revoke their access to your health data.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              // Crucial step: Use arrayRemove to remove the specific ID from the approvedCaregivers array.
              await firestore().collection('users').doc(user.uid).update({
                approvedCaregivers: firestore.FieldValue.arrayRemove(caregiverIdToRemove),
              });
              Alert.alert("Success", "The caretaker has been removed and their access revoked.");
            } catch (error) {
              console.error("Failed to remove caretaker:", error);
              Alert.alert("Error", "Could not remove the caretaker. Please try again.");
            }
          },
        },
      ]
    );
  };



  // --- DATA FETCHING EFFECT (MEDICINES) ---
  useEffect(() => {
    if (!user) return;
    const medSubscriber = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('medicines')
      .onSnapshot(querySnapshot => {
        const medsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMedicines(medsList);
      }, error => {
        console.error("Failed to fetch medicines:", error);
        Alert.alert("Error", "Could not load medicine data.");
      });
    return () => medSubscriber();
  }, [user]);

  // --- HANDLERS ---
  const handleChoosePhoto = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, {
        title: "Gallery Permission",
        message: "App needs access to your gallery to update your profile photo.",
        buttonPositive: "OK",
      },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert("Permission Denied", "You cannot select a photo without permission.");
        return;
      }
    }
    launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert("Error", response.errorMessage || "Something went wrong.");
        return;
      }
      const asset = response.assets?.[0];
      if (asset?.uri) {
        setIsPhotoUploading(true);
        try {
          const uploadUri = asset.uri;
          const fileName = `profile_photo.jpg`;
          const storageRef = storage().ref(`users/${user.uid}/${fileName}`);
          await storageRef.putFile(uploadUri);
          const url = await storageRef.getDownloadURL();
          await firestore().collection('users').doc(user.uid).update({
            profileImg: url
          });
          Alert.alert("Success", "Your profile photo has been updated.");
        } catch (e) {
          console.error(e);
          Alert.alert("Upload Failed", "An error occurred while uploading the photo.");
        } finally {
          setIsPhotoUploading(false);
        }
      }
    });
  };

  const handleUpdateProfile = async () => {
    if (!formData.name || !formData.age || !formData.gender || !formData.bloodGroup) {
      Alert.alert("Missing Information", "Please fill out all fields.");
      return;
    }
    setIsUpdating(true);
    try {
      await firestore().collection("users").doc(user.uid).set(formData, { merge: true });
      Alert.alert("Success", "Your profile has been updated.");
      setEditModalVisible(false);
    } catch (error) {
      console.error("Update failed:", error);
      Alert.alert("Error", "Could not update your profile. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openDropdown = (field, options) => setDropdown({ visible: true, field, options });
  const handleSelectOption = (option) => {
    setFormData({ ...formData, [dropdown.field]: option });
    setDropdown({ visible: false, field: null, options: [] });
  };

  // --- RENDER LOGIC ---
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading Profile...</Text>
      </View>
    );
  }

  if (!user || !profileData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Could not load user profile.</Text>
      </View>
    );
  }

  const isProfileIncomplete = !profileData.name || !profileData.age || !profileData.gender || !profileData.bloodGroup;

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: profileData.profileImg || "https://i.pinimg.com/564x/f1/0f/f7/f10ff70a7155e5ab666bcdd1b45b726d.jpg" }}
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.editIconWrapper} onPress={handleChoosePhoto} disabled={isPhotoUploading}>
              <Text style={styles.editIconText}>✏️</Text>
            </TouchableOpacity>
            {isPhotoUploading && (
              <View style={styles.photoLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFF" />
              </View>
            )}
          </View>
          <Text style={styles.name}>{profileData.name || "No Name Set"}</Text>
          <Text style={styles.email}>{profileData.email}</Text>

          {/* --- MODIFICATION: Display Patient ID --- */}
          {profileData.patientId && (
            <View style={styles.patientIdContainer}>
              <Text style={styles.patientIdText}>Your Patient ID: {profileData.patientId}</Text>
            </View>
          )}
          {/* --- END MODIFICATION --- */}

          <Pressable
            style={[styles.btn, { marginTop: 15 }, isProfileIncomplete && { backgroundColor: '#f59e0b' }]}
            onPress={() => setEditModalVisible(true)}
          >
            <Text style={styles.btnText}>{isProfileIncomplete ? 'Complete Your Profile' : 'Edit Profile'}</Text>
          </Pressable>
        </View>

        {/* Info Row, Doctor, Reports, etc. */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>Age: {profileData.age || "--"}</Text>
          <Text style={styles.infoText}>Gender: {profileData.gender || "--"}</Text>
          <Text style={styles.infoText}>Blood: {profileData.bloodGroup || "--"}</Text>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned Doctor</Text>
          <View style={styles.doctorInfoRow}>
            <Text style={styles.sectionValue}>Dr. {doctorName || "Not Assigned"}</Text>
            {profileData.approvedDoctor && (
              <TouchableOpacity style={styles.removeDoctorBtn} onPress={handleRemoveDoctor}>
                <Icon name="user-x" size={16} color="#dc2626" style={{ marginRight: 4 }} />
                <Text style={styles.removeDoctorBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Caretaker</Text>
          <View style={styles.doctorInfoRow}>
            <Text style={styles.sectionValue}>{caretakerName || "Not Assigned"}</Text>
            {/* ✨ NEW: REMOVE CARETAKER BUTTON */}
            {profileData.approvedCaregivers?.length > 0 && (
              <TouchableOpacity style={styles.removeDoctorBtn} onPress={handleRemoveCaretaker}>
                <Icon name="user-x" size={16} color="#dc2626" style={{ marginRight: 4 }} />
                <Text style={styles.removeDoctorBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ✨ MODIFIED: Reports Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports</Text>
          {reports.length > 0 ? (
            <View style={styles.reportSummary}>
              <Text style={styles.sectionValue}>{reports.length} report(s) available.</Text>
              <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate('ReportsScreen')}>
                <Text style={styles.viewBtnText}>View Reports</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.emptyMessage}>No reports have been uploaded yet.</Text>
          )}
        </View>

        {/* Current Medicines Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Medicines</Text>
          {medicines.length > 0 ? (
            medicines.map((med) => (
              <View key={med.id} style={styles.medicineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{med.name}</Text>
                  <Text style={styles.medDetails}>
                    {med.meal} • Times: {med.times ? med.times.join(', ') : 'N/A'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.medStock}>Stock: {med.stock || 0}</Text>
                </View>
              </View>
            ))
          ) : (<Text style={styles.emptyMessage}>No medicines are currently prescribed.</Text>)}
        </View>
      </ScrollView>

      {/* --- FIXED: Main Edit Profile Modal --- */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Your Profile</Text>
            <TextInput style={styles.input} placeholder="Full Name" value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} />
            <TextInput style={styles.input} placeholder="Age" keyboardType="numeric" value={String(formData.age)} onChangeText={(text) => setFormData({ ...formData, age: text })} />

            <Pressable style={styles.input} onPress={() => openDropdown('gender', GENDER_OPTIONS)}>
              <Text style={formData.gender ? styles.inputText : styles.placeholderText}>{formData.gender || "Select Gender"}</Text>
            </Pressable>

            <Pressable style={styles.input} onPress={() => openDropdown('bloodGroup', BLOOD_GROUP_OPTIONS)}>
              <Text style={formData.bloodGroup ? styles.inputText : styles.placeholderText}>{formData.bloodGroup || "Select Blood Group"}</Text>
            </Pressable>

            <Pressable style={styles.modalBtn} onPress={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Save Changes</Text>}
            </Pressable>
            <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setEditModalVisible(false)} disabled={isUpdating}>
              <Text style={[styles.modalBtnText, { color: '#333' }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* --- FIXED: Generic Dropdown Options Modal --- */}
      <Modal visible={dropdown.visible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setDropdown({ visible: false, field: null, options: [] })}>
          <View style={styles.dropdownCard}>
            <FlatList
              data={dropdown.options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectOption(item)}>
                  <Text style={styles.dropdownItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

export default PatientProfile;

// --- Add new styles for the Patient ID display ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: '#333' },
  profileSection: { alignItems: "center", marginBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 10, },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#e2e8f0' },
  editIconWrapper: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', },
  editIconText: { fontSize: 18, },
  photoLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderRadius: 60, },
  name: { fontSize: 22, fontWeight: "700" },
  email: { fontSize: 14, color: "#666" },
  patientIdContainer: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe'
  },
  patientIdText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338ca',
  },
  infoRow: { flexDirection: "row", justifyContent: "space-around", marginVertical: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderRadius: 10 },
  infoText: { fontSize: 14, fontWeight: "600", color: "#333" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8, color: '#111' },
  sectionValue: { fontSize: 14, color: "#444" },
  // --- NEW STYLES FOR DOCTOR REMOVAL BUTTON ---
  doctorInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeDoctorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5'
  },
  removeDoctorBtnText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 13,
  },
  // --- END NEW STYLES ---
  btn: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: "center", marginTop: 12 },
  btnText: { color: "#fff", fontWeight: "600" },
  emptyMessage: { color: '#64748b', fontStyle: 'italic', marginTop: 8 },
  medicineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: "#f1f5f9" },
  medName: { fontSize: 15, fontWeight: "600", color: '#111' },
  medDetails: { fontSize: 13, color: "#64748b", marginTop: 4, },
  medStock: { fontSize: 14, fontWeight: '700', color: '#334155' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderRadius: 12, width: '90%', elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15, justifyContent: 'center' },
  inputText: { fontSize: 15, color: '#000' },
  placeholderText: { fontSize: 15, color: '#9ca3af' },
  modalBtn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { backgroundColor: '#e2e8f0' },
  dropdownCard: { backgroundColor: '#fff', borderRadius: 8, width: '90%', maxHeight: 200, elevation: 5, paddingVertical: 8 },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownItemText: { fontSize: 16 },
  reportSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  viewBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});