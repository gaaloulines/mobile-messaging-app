import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import Auth from './screens/Auth';        
import Register from './screens/Register'; 
import ChatScreen from './screens/chatScreen'; 

// IMPORT HOME (This contains your Tabs/Navbar)
// Adjust the path './screens/Home' depending on where Home.js is located
import Home from './screens/Home'; 
import GroupListScreen from './screens/Home/groupchat/GroupListScreen';
import GroupChatScreen from './screens/Home/groupchat/GroupChatScreen';
import GroupSettingsScreen from './screens/Home/groupchat/GroupSettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Auth">
        
        <Stack.Screen 
          name="Auth" 
          component={Auth} 
          options={{ headerShown: false }} 
        />
        
        <Stack.Screen 
          name="Register" 
          component={Register} 
          options={{ headerShown: false }} 
        />

        {/* 
           CHANGE THIS: 
           Instead of 'List', we load 'Home'. 
           Home contains the Tab Navigator (List, Group, MyAccount).
        */}
        <Stack.Screen 
          name="Home" 
          component={Home} 
          options={{ headerShown: false }} 
        />

        {/* 
           Keep Chat here so when you click a person in the List, 
           it opens on top of the tabs 
        */}
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="GroupList" 
          component={GroupListScreen} 
          options={{ title: 'Groups' }} 
        />
        
        <Stack.Screen 
          name="GroupChat" 
          component={GroupChatScreen} 
          options={{ headerShown: false }} // We use a custom header in the component
        />
        
        <Stack.Screen 
          name="GroupSettings" 
          component={GroupSettingsScreen} 
          options={{ title: 'Group Settings' }} 
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}