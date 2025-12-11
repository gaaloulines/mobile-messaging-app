import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons'; 

import Group from './Home/Group';
import List from './Home/List'; 
import MyAccount from './Home/MyAccount'; 

// Group chat related screens
import GroupListScreen from './Home/groupchat/GroupListScreen';
import GroupChat from './Home/groupchat/GroupChatScreen';
import GroupSettingsScreen from './Home/groupchat/GroupSettingsScreen';

const Tab = createBottomTabNavigator();

export default function Home() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'List':
              iconName = focused ? 'list-circle' : 'list-circle-outline';
              break;

            case 'Group':
              iconName = focused ? 'people-circle' : 'people-circle-outline';
              break;

            case 'GroupList':
              iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
              break;

            case 'My Account':
              iconName = focused ? 'person-circle' : 'person-circle-outline';
              break;

            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#5426c0',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="List" component={List} />
      <Tab.Screen name="Group" component={Group} />
      <Tab.Screen name="GroupList" component={GroupListScreen} />
      <Tab.Screen name="My Account" component={MyAccount} />

      {/* Not tabs — accessed via navigation.navigate() */}
      {/* You should add these in a stack outside of the tabs */}
      {/* <Tab.Screen name="GroupChat" component={GroupChat} /> */}
      {/* <Tab.Screen name="GroupSettings" component={GroupSettingsScreen} /> */}

    </Tab.Navigator>
  );
}
