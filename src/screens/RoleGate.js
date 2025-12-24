import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
// Correct import for auth
import auth from '@react-native-firebase/auth'; 

export default function RoleGate({ navigation }) {
  const { profile, initializing } = useAuth();

  useEffect(() => {
    if (!initializing && profile?.role) {
      if (profile.role === 'doctor') {
        navigation.reset({ index: 0, routes: [{ name: 'DoctorTabs' }] });
      } else if (profile.role === 'caregiver') {
        navigation.reset({ index: 0, routes: [{ name: 'CaregiverTabs' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'PatientTabs' }] });
      }
    }
  }, [profile?.role, initializing, navigation]);

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{marginTop: 10}}>Loading profile…</Text>
      </View>
    );
  }

  // This screen shows if the Firestore document is missing or lacks a role
  if (!profile?.role) {
    return (
      <View style={styles.center}>
        <Text>No role found. Please log out and try again.</Text>
        {/* Correct way to call signOut */}
        <Pressable onPress={() => auth().signOut()} style={styles.signout}>
          <Text style={{ color: '#fff' }}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  // Fallback screen while redirecting
  return (
    <View style={styles.center}>
      <Text>Redirecting based on role…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  signout: { marginTop: 16, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#ef4444', borderRadius: 10 }
});