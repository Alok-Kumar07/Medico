import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const roles = ['doctor', 'patient', 'caregiver'];

export default function LoginScreen() {
  const [selectedRole, setSelectedRole] = useState('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');

  // This function is now only for creating a profile during registration.
  const createProfile = async (user, role) => {
    const userRef = firestore().collection('users').doc(user.uid);
    await userRef.set({
      uid: user.uid,
      email: user.email,
      role: role,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  };

  const onSubmit = async () => {
    if (!email || !password) {
        setError('Please enter both email and password.');
        return;
    }
    setError('');
    try {
      if (mode === 'register') {
        // --- Registration Logic ---
        const res = await auth().createUserWithEmailAndPassword(email.trim(), password);
        // Create the user's profile in Firestore with the selected role
        await createProfile(res.user, selectedRole);
      } else {
        // --- Login Logic ---
        // Just sign in. The useAuth hook will handle fetching the profile.
        await auth().signInWithEmailAndPassword(email.trim(), password);
      }
    } catch (e) {
      console.error('Auth error:', e);
      setError(e?.message ?? 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Medication App</Text>
      <Text style={styles.subtitle}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
      
      {/* Role selection only appears in register mode */}
      {mode === 'register' && (
         <View style={styles.roleRow}>
            {roles.map(r => (
            <Pressable
                key={r}
                onPress={() => setSelectedRole(r)}
                style={[styles.rolePill, selectedRole === r && styles.rolePillActive]}>
                <Text style={[styles.roleText, selectedRole === r && styles.roleTextActive]}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
            </Pressable>
            ))}
        </View>
      )}


      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.primaryBtn} onPress={onSubmit}>
        <Text style={styles.primaryText}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </Text>
      </Pressable>

      <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
        <Text style={styles.link}>
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Have an account? Sign In'}
        </Text>
      </Pressable>
    </View>
  );
}

// Your existing styles...
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 16, opacity: 0.7 },
  roleRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' },
  rolePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 6,
    marginVertical: 4,
  },
  rolePillActive: { backgroundColor: '#222', borderColor: '#222' },
  roleText: { color: '#222' },
  roleTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, marginVertical: 8 },
  primaryBtn: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, marginTop: 10 },
  primaryText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 12, color: '#2563eb' },
  error: { color: '#b00020', marginTop: 8, textAlign: 'center' },
});