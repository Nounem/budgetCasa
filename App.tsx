import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import {
  Home, CreditCard, Repeat2, TrendingUp, SlidersHorizontal,
} from 'lucide-react-native';

import { initialiserBase } from './src/db/database';
import Dashboard from './src/screens/Dashboard';
import Depenses from './src/screens/Depenses';
import Charges from './src/screens/Charges';
import Previsions from './src/screens/Previsions';
import Parametres from './src/screens/Parametres';

const Tab = createBottomTabNavigator();

const EMERALD   = '#065F46';
const INACTIF   = '#9CA3AF';
const FOND_TAB  = '#FFFFFF';

export default function App() {
  const [pret, setPret]     = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (Platform.OS === 'web') { setPret(true); return; }
    try { initialiserBase(); setPret(true); }
    catch (e: any) { setErreur(e.message); }
  }, []);

  if (!pret) {
    return (
      <View style={styles.chargement}>
        <Text style={styles.chargement_texte}>{erreur || 'Chargement...'}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: EMERALD,
          tabBarInactiveTintColor: INACTIF,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -2,
          },
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: FOND_TAB,
            borderTopWidth: 0,
            elevation: 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            height: 72,
            borderRadius: 28,
            marginHorizontal: 16,
            marginBottom: 20,
            paddingTop: 10,
            paddingBottom: 10,
          },
        }}>

        <Tab.Screen
          name="Budget"
          component={Dashboard}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Home size={size} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tab.Screen
          name="Dépenses"
          component={Depenses}
          options={{
            tabBarIcon: ({ color, size }) => (
              <CreditCard size={size} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tab.Screen
          name="Charges"
          component={Charges}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Repeat2 size={size} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tab.Screen
          name="Prévisions"
          component={Previsions}
          options={{
            tabBarIcon: ({ color, size }) => (
              <TrendingUp size={size} color={color} strokeWidth={2} />
            ),
          }}
        />
        <Tab.Screen
          name="Paramètres"
          component={Parametres}
          options={{
            tabBarIcon: ({ color, size }) => (
              <SlidersHorizontal size={size} color={color} strokeWidth={2} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  chargement: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F6F3',
  },
  chargement_texte: {
    fontSize: 15,
    color: '#6B7280',
  },
});
