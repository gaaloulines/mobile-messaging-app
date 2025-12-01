import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons'; 

import Group from './Home/Group';
import List from './Home/List'; // Ensure path is correct
import MyAccount from './Home/MyAccount'; // Ensure path is correct
// Removed ChatScreen import from here

const Tab = createBottomTabNavigator();

export default function Home() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'List') {
            iconName = focused ? 'list-circle' : 'list-circle-outline';
          } else if (route.name === 'Group') {
            iconName = focused ? 'people-circle' : 'people-circle-outline';
          } else if (route.name === 'My Account') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#5426c0',
        tabBarInactiveTintColor: 'gray',   
      })}
    >
      <Tab.Screen name="List" component={List} />
      <Tab.Screen name="Group" component={Group} />
      <Tab.Screen name="My Account" component={MyAccount} />
      
      {/* Removed Chat Tab. You access Chat by clicking an item in the List */}
      
    </Tab.Navigator>
  );
}