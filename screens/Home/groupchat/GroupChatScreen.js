import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native'; // Added useRoute
import { getDatabase, ref, push, onValue } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';

import { auth, app } from '../../../config/index'; 

const { width } = Dimensions.get('window');

const GroupChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const flatListRef = useRef(null);

  // 1. GET DYNAMIC DATA FROM NAVIGATION
  // Fallback values provided just in case
  const { groupId, groupName } = route.params || { groupId: 'general', groupName: 'Group' };
  
  // Data State
  const [messages, setMessages] = useState([]);
  const [allUsers, setAllUsers] = useState({}); 
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);

  // UI State
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  
  const currentUser = auth.currentUser;
  const db = getDatabase(app);

  // --- 2. FETCH ALL USERS (To show names/avatars) ---
  useEffect(() => {
    const usersRef = ref(db, 'all_accounts');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        setAllUsers(snapshot.val());
      }
    });
    return () => unsubscribeUsers();
  }, []);

  // --- 3. LOAD GROUP MESSAGES (DYNAMIC ID) ---
  useEffect(() => {
    if (!groupId) return;

    const messagesRef = ref(db, `chatrooms/${groupId}/messages`);
    
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const messagesData = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          messagesData.push({
            id: child.key,
            ...child.val()
          });
        });
      }
      setMessages(messagesData); 
    });

    return () => unsubscribeMessages();
  }, [groupId]); // Re-run if groupId changes

  // --- 4. SEND MESSAGE ---
  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const messagesRef = ref(db, `chatrooms/${groupId}/messages`);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessage = {
      text: inputText,
      type: 'text',
      senderId: currentUser.uid,
      time: timestamp,
      timestamp: Date.now(),
    };

    try {
      await push(messagesRef, newMessage);
      setInputText('');
    } catch (error) {
      console.error("Error sending message: ", error);
    }
  };

  // --- 5. IMAGE UPLOAD LOGIC (FIXED FOR ANDROID) ---
  const pickAndSendImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, 
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadImageToSupabase(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error picking image", error.message);
    }
  };

  const uploadImageToSupabase = async (uri) => {
    setUploading(true);
    try {
      const ext = uri.substring(uri.lastIndexOf('.') + 1);
      const fileName = `${groupId}_${Date.now()}.${ext}`;

      // 1. Fix URI for Android
      const uriFixed = Platform.OS === 'android' && !uri.startsWith('file://') 
        ? `file://${uri}` 
        : uri;

      // 2. Convert to Blob (Fixes Network Request Failed)
      const response = await fetch(uriFixed);
      const blob = await response.blob();

      // 3. Upload to Supabase
      const { data, error } = await supabase.storage
        .from('chat-images') // Ensure this bucket exists
        .upload(fileName, blob, {
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          upsert: true, 
        });

      if (error) throw new Error(error.message);

      // 4. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      // 5. Send Message to Firebase
      const messagesRef = ref(db, `chatrooms/${groupId}/messages`);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await push(messagesRef, {
        text: '📷 Image', 
        imageUrl: publicUrlData.publicUrl,
        type: 'image',
        senderId: currentUser.uid,
        time: timestamp,
        timestamp: Date.now(),
      });

    } catch (err) {
      Alert.alert("Upload Failed", "Could not send image.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // --- 6. RENDER MESSAGE ITEM ---
  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;
    const senderData = allUsers[item.senderId] || {}; 
    
    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.otherMessage
      ]}>
        
        {!isMe && (
          <Image 
            source={senderData.picture ? { uri: senderData.picture } : require('../../../assets/profile.jpeg')} 
            style={styles.senderAvatar} 
          />
        )}

        <View style={[
          styles.messageBubble,
          isMe ? styles.myBubble : styles.otherBubble,
          item.type === 'image' && styles.imageBubble 
        ]}>
          
          {!isMe && (
            <Text style={styles.senderName}>
              {senderData.nom || 'Unknown'}
            </Text>
          )}

          {item.type === 'image' ? (
             <Image 
               source={{ uri: item.imageUrl }} 
               style={styles.chatImage} 
               resizeMode="cover"
             />
          ) : (
            <Text style={isMe ? styles.myMessageText : styles.otherMessageText}>
              {item.text}
            </Text>
          )}

          <Text style={isMe ? styles.myTimeText : styles.otherTimeText}>
            {item.time}
          </Text>
        </View>
      </View>
    );
  };

  const sharedImages = messages.filter(m => m.type === 'image');

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          {/* Back Button */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 10}}>
             <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          {/* Group Icon */}
          <View style={styles.groupIconContainer}>
            <Ionicons name="people" size={24} color="#fff" />
          </View>
          
          <View style={styles.userText}>
            <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
          </View>
        </View>

        <View style={{flexDirection: 'row', gap: 15}}>
            {/* View Media Gallery */}
            <TouchableOpacity onPress={() => setMediaModalVisible(true)}>
                <Ionicons name="images-outline" size={24} color="#5426c0" />
            </TouchableOpacity>

            {/* Navigate to Settings (Add/Remove Users) */}
            <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { groupId, groupName })}>
                <Ionicons name="settings-outline" size={24} color="#5426c0" />
            </TouchableOpacity>
        </View>
      </View>

      {/* --- MESSAGES LIST --- */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* --- INPUT AREA --- */}
      <View style={styles.inputContainer}>
        {uploading ? (
           <ActivityIndicator size="small" color="#5426c0" style={{marginRight: 10}}/>
        ) : (
          <TouchableOpacity style={styles.iconButton} onPress={pickAndSendImage}>
            <Ionicons name="image" size={24} color="#5426c0" />
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.textInput}
          placeholder="Message group..."
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity 
          style={styles.sendButton}
          onPress={sendMessage}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* --- SHARED MEDIA MODAL --- */}
      <Modal
        visible={mediaModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <View style={styles.modalContainer}>
           <View style={styles.modalHeader}>
             <Text style={styles.modalTitle}>Shared Media</Text>
             <TouchableOpacity onPress={() => setMediaModalVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#ccc" />
             </TouchableOpacity>
           </View>

           {sharedImages.length === 0 ? (
             <View style={styles.emptyMedia}>
               <Ionicons name="images-outline" size={50} color="#ccc" />
               <Text style={{color:'#999', marginTop:10}}>No photos shared yet.</Text>
             </View>
           ) : (
             <FlatList 
               data={sharedImages}
               numColumns={3}
               keyExtractor={item => item.id}
               renderItem={({item}) => (
                 <Image source={{uri: item.imageUrl}} style={styles.gridImage} />
               )}
             />
           )}
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: Platform.OS === 'android' ? 40 : 60, 
  },
  groupIconContainer: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#5426c0',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  userText: { justifyContent:'center', maxWidth: width * 0.4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },
  messageContainer: { marginVertical: 4, flexDirection: 'row', alignItems: 'flex-end' },
  myMessage: { justifyContent: 'flex-end' },
  otherMessage: { justifyContent: 'flex-start' },
  
  senderAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 4 },
  
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 18, marginBottom: 4 },
  imageBubble: { padding: 5, borderRadius: 10, overflow:'hidden' }, 
  myBubble: { backgroundColor: '#5426c0', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e0e0e0' },
  
  senderName: { fontSize: 11, color: '#5426c0', fontWeight: 'bold', marginBottom: 4 },
  chatImage: { width: 200, height: 200, borderRadius: 10 },

  myMessageText: { fontSize: 16, color: '#fff', marginBottom: 4 },
  otherMessageText: { fontSize: 16, color: '#333', marginBottom: 4 },
  myTimeText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', alignSelf: 'flex-end' },
  otherTimeText: { fontSize: 10, color: '#999', alignSelf: 'flex-end' },
  
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingBottom: Platform.OS === 'ios' ? 30 : 12 },
  iconButton: { padding: 8, marginHorizontal: 4 },
  textInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 8, fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: '#5426c0', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },

  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth:1, borderColor:'#eee' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  emptyMedia: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gridImage: { width: width / 3, height: width / 3, margin: 1 }
});

export default GroupChatScreen;