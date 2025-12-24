import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/FontAwesome';

import CaregiverHome from '../../screens/caretaker/CaregiverHome';
import VerifyScreen from '../../screens/caretaker/VerifyScreen';
import AddPatientScreen from '../../screens/caretaker/AddPatientScreen';

const Tab = createBottomTabNavigator();

export default function CaregiverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let icon = 'home';
          if (route.name === 'CaregiverHome') icon = 'home';
          if (route.name === 'VerifyScreen') icon = 'check-circle';
          if (route.name === 'AddPatientScreen') icon = 'user';
          return <Icon name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="CaregiverHome" component={CaregiverHome} />
      <Tab.Screen name="VerifyScreen" component={VerifyScreen} />
      <Tab.Screen name="AddPatientScreen" component={AddPatientScreen} />
    </Tab.Navigator>
  );
}
