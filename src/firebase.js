// firebase.js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// auto-detects google-services.json / plist

const firebaseConfig = {
  apiKey: "AIzaSyCCcTZr5-B7Qr93gL3I0Aa773t8lL56f8Q",
  authDomain: "medico-50c45.firebaseapp.com",
  projectId: "medico-50c45",
  storageBucket: "medico-50c45.firebasestorage.app",
  messagingSenderId: "27784756760",
  appId: "1:27784756760:web:feab93c3b7d77550fc0d6d"
};

export { auth, firestore, storage };

