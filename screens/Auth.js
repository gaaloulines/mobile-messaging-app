import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
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

// 1. IMPORT DATABASE FUNCTIONS
import { auth, app } from '../config/index.js';
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database"; 

const image = require('../assets/bg-image.png');

export default function Auth({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); 

const handleSignIn = () => {
    if (!email || !password) {
      Alert.alert("Input Required", "Please enter both email and password.");
      return;
    }

    setLoading(true); 

    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        console.log('Signed in as:', user.email);

       // 2. CHECK DATABASE FOR 'number' FIELD
        const db = getDatabase(app);
        const userRef = ref(db, `all_accounts/${user.uid}`);

        try {
          const snapshot = await get(userRef);
          
          let isProfileComplete = false;

          if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.number && userData.number.trim().length > 0) {
              isProfileComplete = true;
            }
          }

          if (isProfileComplete) {
            // Number is initialized -> Go to Default Home (List)
            navigation.replace('Home');
          } else {
            // Number is empty string -> Redirect to My Account tab
            Alert.alert("Profile Incomplete", "Please complete your profile by adding your Phone Number.");
            
            // Navigate to the 'Home' stack, specifically the 'My Account' tab
            navigation.replace('Home', { screen: 'My Account' });
          }

        } catch (dbError) {
          console.error("Database check failed:", dbError);
          // Fallback: If DB check fails, go to Home to avoid locking user out
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