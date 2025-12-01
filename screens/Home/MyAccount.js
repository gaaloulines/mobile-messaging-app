import { StyleSheet, Text, View, Image, TouchableOpacity, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import React, { useState, useEffect } from 'react'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker'; 

// IMPORTS
import { auth, app, supabase } from '../../config/index.js'; 
import { onAuthStateChanged, signOut, deleteUser, updateProfile } from 'firebase/auth';
import { getDatabase, ref, set, remove, get, update, child } from 'firebase/database';

const MyAccount = () => {
  const navigation = useNavigation();
  const db = getDatabase(app);
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form Data
  const [displayName, setDisplayName] = useState(''); // This acts as 'nom'
  const [phoneNumber, setPhoneNumber] = useState(''); // This acts as 'number'
  const [profileImage, setProfileImage] = useState(null); // This acts as 'picture'

  // --- 1. LOAD USER DATA ---
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          setUser(currentUser);
          
          // Default from Auth
          setDisplayName(currentUser.displayName || '');
          setProfileImage(currentUser.photoURL); 

          // Fetch from Realtime DB (all_accounts)
          const snapshot = await get(child(ref(db), `all_accounts/${currentUser.uid}`));
          if (snapshot.exists()) {
            const data = snapshot.val();
            // Map 'nom' to displayName input
            setDisplayName(data.nom || currentUser.displayName || '');
            // Map 'number' to phoneNumber input
            setPhoneNumber(data.number || '');
            // Map 'picture' to profileImage
            if(data.picture) setProfileImage(data.picture);
          }
        }
      } catch (error) { 
        console.error("Fetch Error:", error); 
      } finally { 
        setLoading(false); 
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if(currentUser) fetchUserData();
        else setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. PICK IMAGE ---
  const pickImage = async () => {
    try {
      if (!isEditing) return;

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Allow gallery access in settings.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImageToSupabase(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Picker Error", error.message);
    }
  };

  // --- 3. UPLOAD TO SUPABASE ---
  const uploadImageToSupabase = async (uri) => {
    setUploading(true);
    try {
      const currentUser = auth.currentUser;
      const ext = uri.substring(uri.lastIndexOf('.') + 1);
      const fileName = `${currentUser.uid}_${Date.now()}.${ext}`;

      const formData = new FormData();
      
      const uriFixed = Platform.OS === 'android' && !uri.startsWith('file://') 
        ? `file://${uri}` 
        : uri;

      formData.append('file', {
        uri: uriFixed,
        name: fileName,
        type: `image/${ext === 'png' ? 'png' : 'jpeg'}`, 
      });

      const supabaseUrl = supabase.supabaseUrl;
      const supabaseKey = supabase.supabaseKey;

      // Ensure your bucket is 'profileimages'
      const fileUrl = `${supabaseUrl}/storage/v1/object/profileimages/${fileName}`;
      
      const response = await fetch(fileUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey, 
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      const { data } = supabase.storage
        .from('profileimages')
        .getPublicUrl(fileName);
        
      setProfileImage(data.publicUrl);
      
    } catch (err) {
      console.error("Upload Catch:", err);
      Alert.alert("Upload Failed", err.message);
    } finally {
      setUploading(false);
    }
  };

  // --- 4. SAVE CHANGES (Updated for all_accounts) ---
  const handleSave = async () => {
    if (!displayName) return Alert.alert("Error", "Name is required.");
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      
      // Update Firebase Auth
      await updateProfile(currentUser, { 
        displayName: displayName, 
        photoURL: profileImage 
      });

      // Update Realtime Database ('all_accounts')
      const updates = {};
      const basePath = `all_accounts/${currentUser.uid}`;
      
      updates[`${basePath}/nom`] = displayName;      // Match List.js
      updates[`${basePath}/pseudo`] = displayName;   // Keeping pseudo same as name for simplicity
      updates[`${basePath}/number`] = phoneNumber;   // Match List.js
      updates[`${basePath}/picture`] = profileImage; // Match List.js (picture)
      
      await update(ref(db), updates);

      setIsEditing(false);
      Alert.alert("Success", "Profile updated!");
    } catch (error) { 
      Alert.alert("Error", "Save failed: " + error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  // --- UI ACTIONS ---
  const handleDeleteAccount = () => {
    if (!user) return;
    Alert.alert(
      'Delete Account',
      'Are you sure? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      // Remove from all_accounts
      const userRef = ref(db, `all_accounts/${user.uid}`);
      await remove(userRef);
      await deleteUser(user);
      Alert.alert('Success', 'Account deleted.');
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    } catch (error) {
      Alert.alert('Error', 'Please login again to delete account.');
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => { Alert.alert("Error", error.message); });
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const startEditing = () => {
    setIsEditing(true);
    if(!phoneNumber) setPhoneNumber(''); 
  };

  const cancelEditing = () => {
    setIsEditing(false);
    // Revert changes from User object or reload from DB
    setDisplayName(user?.displayName || '');
    setProfileImage(user?.photoURL); 
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5426c0" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        {/* --- PROFILE IMAGE SECTION --- */}
        <TouchableOpacity onPress={pickImage} disabled={!isEditing} style={styles.avatarContainer}>
          <Image
            source={
              profileImage 
                ? { uri: profileImage } 
                : require('../../assets/profile.jpeg') 
            }
            style={styles.avatar}
          />
          
          {isEditing && (
            <View style={styles.cameraIconOverlay}>
              {uploading ? (
                 <ActivityIndicator color="#fff" size="small" />
              ) : (
                 <Ionicons name="camera" size={24} color="#fff" />
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* --- NAME SECTION --- */}
        {isEditing ? (
          <TextInput
            style={styles.editInput}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
          />
        ) : (
          <Text style={styles.name}>{displayName || user?.displayName || 'User Name'}</Text>
        )}

        {/* --- DETAILS CARD --- */}
        <View style={styles.detailsCard}>
          <View style={styles.detailItem}>
            <Ionicons name="mail-outline" size={24} color="#555" style={styles.icon} />
            <Text style={styles.detailText}>{user?.email}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={24} color="#555" style={styles.icon} />
            {isEditing ? (
              <TextInput
                style={styles.editInputSmall}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.detailText}>{phoneNumber || '+216 -- --- ---'}</Text>
            )}
          </View>
        </View>

        {/* --- ACTION BUTTONS --- */}
        <View style={styles.buttonsContainer}>
          {isEditing ? (
            <View style={styles.editButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={uploading}>
                {uploading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.editButton} onPress={startEditing}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default MyAccount;

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  content: { flex: 1, alignItems: 'center', padding: 20, paddingTop: 50 },
  avatarContainer: { position: 'relative', marginBottom: 20 },
  avatar: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#ffffff', backgroundColor: '#ddd' },
  cameraIconOverlay: { position: 'absolute', bottom: 5, right: 5, backgroundColor: '#5426c0', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 30 },
  editInput: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 30, borderBottomWidth: 2, borderBottomColor: '#5426c0', textAlign: 'center', paddingHorizontal: 10, paddingVertical: 5, width: '80%' },
  editInputSmall: { fontSize: 16, color: '#333', borderBottomWidth: 1, borderBottomColor: '#5426c0', flex: 1, marginLeft: 10, paddingVertical: 5 },
  detailsCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 15, paddingVertical: 10, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, marginBottom: 20 },
  detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  icon: { marginRight: 15 },
  detailText: { fontSize: 16, color: '#333' },
  separator: { height: 1, width: '100%', backgroundColor: '#e0e0e0' },
  buttonsContainer: { width: '100%', gap: 15 },
  editButtons: { gap: 10, width: '100%' },
  editButton: { width: '100%', height: 50, backgroundColor: '#5426c0', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  editButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  saveButton: { width: '100%', height: 50, backgroundColor: '#27ae60', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelButton: { width: '100%', height: 50, backgroundColor: '#95a5a6', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  deleteButton: { width: '100%', height: 50, backgroundColor: '#e74c3c', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  logoutButton: { width: '100%', height: 50, backgroundColor: '#34495e', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});