import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  TextInput, 
  Platform,
  Modal, // 1. Added Modal
  KeyboardAvoidingView 
} from 'react-native';
import React, { useState, useEffect } from 'react'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, app, supabase } from '../../config/index.js'; 
// 2. Added EmailAuthProvider and reauthenticateWithCredential
import { 
  onAuthStateChanged, 
  signOut, 
  deleteUser, 
  updateProfile, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { getDatabase, ref, set, remove, get, update, child } from 'firebase/database';

const MyAccount = () => {
  const navigation = useNavigation();
  const db = getDatabase(app);
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [displayName, setDisplayName] = useState(''); 
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [profileImage, setProfileImage] = useState(null); 

  // --- NEW STATE FOR DELETE MODAL ---
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

 
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          setUser(currentUser);
          
          setDisplayName(currentUser.displayName || '');
          setProfileImage(currentUser.photoURL); 

          const snapshot = await get(child(ref(db), `all_accounts/${currentUser.uid}`));
          if (snapshot.exists()) {
            const data = snapshot.val();
            setDisplayName(data.nom || currentUser.displayName || '');
            setPhoneNumber(data.number || '');
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


  const handleSave = async () => {
    if (!displayName) return Alert.alert("Error", "Name is required.");
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      
      await updateProfile(currentUser, { 
        displayName: displayName, 
        photoURL: profileImage 
      });
      const updates = {};
      const basePath = `all_accounts/${currentUser.uid}`;
      
      updates[`${basePath}/nom`] = displayName;      
      updates[`${basePath}/pseudo`] = displayName;   
      updates[`${basePath}/number`] = phoneNumber;  
      updates[`${basePath}/picture`] = profileImage; 
      
      await update(ref(db), updates);

      setIsEditing(false);
const cacheData = {
    uid: currentUser.uid,
    email: currentUser.email,
    nom: displayName,      // Matches your DB field
    pseudo: displayName,   // Matches your DB field
    number: phoneNumber,   // Matches your DB field
    picture: profileImage  // Matches your DB field
};

// Update State (Optional, but good for UI)
// Note: You might need to merge this with your existing user state if you use other fields
setUser({ ...user, ...cacheData }); 

// Update Cache
await AsyncStorage.setItem('currentUser', JSON.stringify(cacheData));
      Alert.alert("Success", "Profile updated!");
    } catch (error) { 
      Alert.alert("Error", "Save failed: " + error.message); 
    } finally { 
      setLoading(false); 
    }
  };



  // 1. Triggered by the "Delete Account" button
  const handleDeleteAccount = () => {
    if (!user) return;
    // Open the modal instead of the immediate Alert
    setDeleteModalVisible(true);
  };

  // 2. Triggered by the "Delete" button inside the Modal
  const onConfirmDelete = async () => {
    if (!deletePassword) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }

    setIsDeleting(true);

    try {
      const currentUser = auth.currentUser;

      // A. Create credentials
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);

      // B. Re-authenticate (Required for sensitive operations)
      await reauthenticateWithCredential(currentUser, credential);

      // C. Delete from Realtime Database
      const userRef = ref(db, `all_accounts/${currentUser.uid}`);
      await remove(userRef);

      // D. Delete Auth User
      await deleteUser(currentUser);

      setDeleteModalVisible(false);
      Alert.alert('Success', 'Account deleted.');
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
      
    } catch (error) {
      console.log('Delete Error', error);
      setIsDeleting(false); // Stop loading only on error

      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Incorrect password.');
      } else {
        Alert.alert('Error', 'Failed to delete account. ' + error.message);
      }
    }
  };

  // 3. Reset modal state
  const closeDeleteModal = () => {
    setDeleteModalVisible(false);
    setDeletePassword('');
    setIsDeleting(false);
  };
  // --- MODIFIED DELETE FLOW END ---


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

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalWarning}>
              Are you sure? This action cannot be undone. All your data will be permanently removed.
            </Text>
            
            <Text style={styles.modalLabel}>Enter your password to confirm:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry={true}
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelBtn]} 
                onPress={closeDeleteModal}
                disabled={isDeleting}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.modalDeleteBtn]} 
                onPress={onConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalWarning: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 25,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#ccc',
  },
  modalDeleteBtn: {
    backgroundColor: '#e74c3c',
  },
  modalBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});