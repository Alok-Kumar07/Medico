import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useAuth } from '../../hooks/useAuth';
import firestore from '@react-native-firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const subscriber = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('notifications')
      .orderBy('timestamp', 'desc')
      .onSnapshot(querySnapshot => {
        const notificationsData = [];
        querySnapshot.forEach(doc => {
          const data = doc.data();
          notificationsData.push({
            id: doc.id,
            ...data,
            time: data.timestamp ? formatDistanceToNow(data.timestamp.toDate()) + ' ago' : 'Just now',
          });
        });
        setNotifications(notificationsData);
        setLoading(false);
      });
    return () => subscriber();
  }, [user]);

  const handleAcceptCaregiverRequest = async (notification) => {
    const patientRef = firestore().collection('users').doc(user.uid);
    const notificationRef = patientRef.collection('notifications').doc(notification.id);
    const batch = firestore().batch();
    batch.update(patientRef, { approvedCaregivers: firestore.FieldValue.arrayUnion(notification.fromId) });
    batch.update(notificationRef, { status: 'accepted' });
    try {
      await batch.commit();
      Alert.alert("Caregiver Added!", `${notification.fromName} can now view your health data.`);
    } catch (error) {
      console.error("Failed to accept caregiver request: ", error);
      Alert.alert("Error", "Could not process the request.");
    }
  };

  // --- ✨ NEW: Logic for accepting a doctor's request ---
  const handleAcceptDoctorRequest = async (notification) => {
    const patientRef = firestore().collection('users').doc(user.uid);
    const notificationRef = patientRef.collection('notifications').doc(notification.id);
    const batch = firestore().batch();
    // Instead of an array, we set a single doctor ID.
    // This can be changed to arrayUnion if a patient can have multiple doctors.
    batch.update(patientRef, { approvedDoctor: notification.fromId });
    batch.update(notificationRef, { status: 'accepted' });
    try {
      await batch.commit();
      Alert.alert("Doctor Approved!", `${notification.fromName} can now view your health data.`);
    } catch (error) {
      console.error("Failed to accept doctor request: ", error);
      Alert.alert("Error", "Could not process the request.");
    }
  };

  const handleRequestPress = (notification) => {
    if (notification.status !== 'pending') return;
    
    // --- ✨ UPDATED: Differentiate between request types ---
    if (notification.type === 'caretaker_request') {
      Alert.alert(
        "Caregiver Request",
        `${notification.fromName} would like access to your health data.`,
        [
          { text: "Decline", style: "cancel" },
          { text: "Accept", onPress: () => handleAcceptCaregiverRequest(notification) }
        ],
        { cancelable: true }
      );
    } else if (notification.type === 'doctor_request') {
      Alert.alert(
        "Doctor Request",
        `${notification.fromName} would like to be assigned as your doctor.`,
        [
          { text: "Decline", style: "cancel" },
          { text: "Accept", onPress: () => handleAcceptDoctorRequest(notification) }
        ],
        { cancelable: true }
      );
    }
  };

  const renderItem = ({ item }) => {
    let icon = "bell";
    let color = "#2563eb";
    let title = "New notification";
    let onPressHandler = () => {};

    // --- ✨ UPDATED: Handle rendering for both request types ---
    if (item.type === 'caretaker_request') {
      icon = 'user-plus';
      color = item.status === 'pending' ? '#f59e0b' : '#888';
      title = item.status === 'accepted' ? `You accepted ${item.fromName}'s request` : `${item.fromName} wants to be your caregiver`;
      onPressHandler = () => handleRequestPress(item);
    } else if (item.type === 'doctor_request') {
      icon = 'user-md'; // Using a doctor icon
      color = item.status === 'pending' ? '#10b981' : '#888';
      title = item.status === 'accepted' ? `You approved Dr. ${item.fromName}` : `Dr. ${item.fromName} sent a request`;
      onPressHandler = () => handleRequestPress(item);
    }

    return (
      <TouchableOpacity
        style={[styles.card, item.status !== 'pending' && styles.cardHandled]}
        onPress={onPressHandler}
        disabled={item.status !== 'pending'}
      >
        <View style={[styles.iconWrapper, { backgroundColor: color + "20" }]}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.heading}>Notifications</Text></View>
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>You have no notifications.</Text></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 75, paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { position: "absolute", top: 0, left: 0, right: 0, height: 60, justifyContent: "center", alignItems: "center", zIndex: 10, elevation: 3, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', },
  heading: { fontSize: 20, fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 14, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, elevation: 3, },
  cardHandled: { backgroundColor: '#f1f5f9' },
  iconWrapper: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12, },
  textWrapper: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#111", marginBottom: 4 },
  time: { fontSize: 12, color: "#666" },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  emptyText: { fontSize: 16, color: '#64748b' }
});
