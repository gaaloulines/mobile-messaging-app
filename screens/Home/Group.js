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
import { useNavigation } from '@react-navigation/native';
import { getDatabase, ref, push, onValue } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';

// IMPORTS
import { auth, app, supabase } from '../../config/index.js';

const { width } = Dimensions.get('window');
const GROUP_ID = 'general_group_chat'; // Static ID for the global group

const Group = () => {
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  
  // Data State
  const [messages, setMessages] = useState([]);
  const [allUsers, setAllUsers] = useState({}); // To store user profiles (id -> data)
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);

  // UI State
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  
  const currentUser = auth.currentUser;
  const db = getDatabase(app);

  // --- 1. FETCH ALL USERS (To show names/avatars) ---
  useEffect(() => {
    const usersRef = ref(db, 'all_accounts');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        setAllUsers(snapshot.val());
      }
    });
    return () => unsubscribeUsers();
  }, []);

  // --- 2. LOAD GROUP MESSAGES ---
  useEffect(() => {
    const messagesRef = ref(db, `chatrooms/${GROUP_ID}/messages`);
    
    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((child) => {
        messagesData.push({
          id: child.key,
          ...child.val()
        });
      });
      setMessages(messagesData); 
    });

    return () => unsubscribeMessages();
  }, []);

  // --- 3. SEND MESSAGE ---
  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const messagesRef = ref(db, `chatrooms/${GROUP_ID}/messages`);
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

  // --- 4. IMAGE UPLOAD LOGIC (Same as ChatScreen) ---
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
      const fileName = `${GROUP_ID}_${Date.now()}.${ext}`;

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

      const fileUrl = `${supabaseUrl}/storage/v1/object/chat-images/${fileName}`;
      
      const response = await fetch(fileUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { data } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      const messagesRef = ref(db, `chatrooms/${GROUP_ID}/messages`);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await push(messagesRef, {
        text: '📷 Image', 
        imageUrl: data.publicUrl,
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

  // --- 5. RENDER MESSAGE ITEM ---
  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;
    const senderData = allUsers[item.senderId] || {}; // Get sender info
    
    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.otherMessage
      ]}>
        
        {/* Show Avatar for Other Users */}
        {!isMe && (
          <Image 
            source={senderData.picture ? { uri: senderData.picture } : require('../../assets/profile.jpeg')} 
            style={styles.senderAvatar} 
          />
        )}

        <View style={[
          styles.messageBubble,
          isMe ? styles.myBubble : styles.otherBubble,
          item.type === 'image' && styles.imageBubble 
        ]}>
          
          {/* Show Sender Name in Group Chat */}
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
      {/* GROUP HEADER */}
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          {/* Group Icon */}
          <View style={styles.groupIconContainer}>
            <Ionicons name="people" size={24} color="#fff" />
          </View>
          
          <View style={styles.userText}>
            <Text style={styles.headerTitle}>Community Group</Text>
            <Text style={styles.headerSubtitle}>
              {Object.keys(allUsers).length} Members
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setMediaModalVisible(true)}>
           <Ionicons name="images-outline" size={24} color="#5426c0" />
        </TouchableOpacity>
      </View>

      {/* MESSAGES LIST */}
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

      {/* INPUT AREA */}
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
             <Text style={styles.modalTitle}>Group Media</Text>
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
    width: 45, height: 45, borderRadius: 22.5,
    backgroundColor: '#5426c0',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  userText: { justifyContent:'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 12, color: 'gray' },
  
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

export default Group;