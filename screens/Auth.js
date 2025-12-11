import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ImageBackground,
  Alert,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Ionicons } from '@expo/vector-icons'; 

import { auth, app } from '../config/index.js';
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database"; 

const image = require('../assets/bg-image.png');

export default function Auth({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); 
  const [rememberMe, setRememberMe] = useState(false);

  // 1. Check for saved credentials (LOGIN CREDENTIALS) on load
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('user_email');
        const savedPassword = await AsyncStorage.getItem('user_password');
        
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (error) {
        console.log('Error loading credentials', error);
      }
    };

    loadCredentials();
  }, []);

  const handleSignIn = () => {
    if (!email || !password) {
      Alert.alert("Input Required", "Please enter both email and password.");
      return;
    }

    setLoading(true); 

    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        
        // 2. Handle Remember Me Logic (Save or Clear Login Credentials)
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('user_email', email);
            await AsyncStorage.setItem('user_password', password);
          } else {
            await AsyncStorage.removeItem('user_email');
            await AsyncStorage.removeItem('user_password');
          }
        } catch (storageError) {
          console.log('Error saving credentials', storageError);
        }

        // Database Check & DATA CACHING
        const db = getDatabase(app);
        const userRef = ref(db, `all_accounts/${user.uid}`);

        try {
          const snapshot = await get(userRef);
          
          let isProfileComplete = false;
          let userData = {};

          if (snapshot.exists()) {
            userData = snapshot.val();
            
            // 3. CACHE USER DATA (Simple & Efficient)
            // We combine Auth UID with DB data for a complete profile object
            const completeUserProfile = {
              uid: user.uid,
              email: user.email,
              ...userData 
            };

            await AsyncStorage.setItem('currentUser', JSON.stringify(completeUserProfile));

            // Check if profile is complete
            if (userData.number && userData.number.trim().length > 0) {
              isProfileComplete = true;
            }
          } else {
            // Even if no DB data exists, cache the basic Auth info
            const basicUser = { uid: user.uid, email: user.email };
            await AsyncStorage.setItem('currentUser', JSON.stringify(basicUser));
          }

          if (isProfileComplete) {
            // Number is initialized -> Go to Default Home
            navigation.replace('Home');
          } else {
            // Number is empty -> Redirect to My Account tab
            Alert.alert("Profile Incomplete", "Please complete your profile by adding your Phone Number.");
            navigation.replace('Home', { screen: 'My Account' });
          }

        } catch (dbError) {
          console.error("Database check failed:", dbError);
          // Fallback
          navigation.replace('Home');
        } finally {
          setLoading(false);
        }
      })
      .catch((error) => {
        setLoading(false);
        let errorMessage = "An error occurred during login. Please try again.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          errorMessage = "Invalid email or password. Please check your credentials.";
        }
        Alert.alert("Login Error", errorMessage);
      });
  };

  const handleCreateUser = () => {
    navigation.navigate('Register');
  };

  const toggleRememberMe = () => {
    setRememberMe(!rememberMe);
  };

  return (
    <ImageBackground
      source={image}
      resizeMode='cover'
      style={styles.imageBackground}
    >
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* --- Remember Me Checkbox --- */}
          <TouchableOpacity style={styles.rememberMeContainer} onPress={toggleRememberMe} activeOpacity={0.6}>
            <Ionicons 
              name={rememberMe ? "checkbox" : "square-outline"} 
              size={24} 
              color={rememberMe ? "#5426c0" : "#999"} 
            />
            <Text style={styles.rememberMeText}>Remember Me</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleSignIn}
            disabled={loading} 
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleCreateUser}>
            <Text style={styles.secondaryButtonText}>Create New Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  imageBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  rememberMeContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  rememberMeText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#666',
  },
  primaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#5426c0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 20,
  },
  secondaryButtonText: {
    color: '#5426c0',
    fontSize: 16,
    fontWeight: '500',
  },
});