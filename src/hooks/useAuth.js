import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (u) => {
      setUser(u);
      setProfile(null);

      if (u) {
        try {
          const snap = await firestore().collection('users').doc(u.uid).get();
          if (snap.exists) {
            setProfile(snap.data());
          }
        } catch (err) {
          console.error('Error fetching profile:', err);
        }
      }

      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  return { user, profile, initializing };
}
