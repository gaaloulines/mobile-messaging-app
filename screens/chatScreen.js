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
import { useNavigation, useRoute } from '@react-navigation/native';
import { getDatabase, ref, push, onValue, update } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking'; 
import * as Location from 'expo-location'; 
import { auth, app, supabase } from '../config/index.js';

const { width } = Dimensions.get('window');

const ChatScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const flatListRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  
  const currentUser = auth.currentUser;
  const { user } = route.params || {};

  // Unique Room ID
  const roomId = currentUser.uid < user.id 
    ? `${currentUser.uid}${user.id}` 
    : `${user.id}${currentUser.uid}`;

  const db = getDatabase(app);

  // --- 1. LOAD MESSAGES & TYPING STATUS ---
  useEffect(() => {
    if (!currentUser || !user) return;

    const messagesRef = ref(db, `chatrooms/${roomId}/messages`);
    
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

    const otherUserTypingRef = ref(db, `chatrooms/${roomId}/typing/${user.id}`);
    const unsubscribeTyping = onValue(otherUserTypingRef, (snapshot) => {
      setIsOtherUserTyping(snapshot.val() === true);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
      update(ref(db, `chatrooms/${roomId}/typing`), {
        [currentUser.uid]: false
      });
    };
  }, [roomId, user.id]);

  // --- 2. PHONE DIALER LOGIC ---
  const handleCall = () => {
    const phoneNumber = user.number || user.phoneNumber;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert("No Number", "This user hasn't added a phone number.");
    }
  };

  // --- 3. SEND TEXT MESSAGE ---
  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const messagesRef = ref(db, `chatrooms/${roomId}/messages`);
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
      handleTypingStatus(false);
    } catch (error) {
      console.error("Error sending message: ", error);
    }
  };

  // --- 4. IMAGE PICKER & UPLOAD LOGIC ---
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
      const fileName = `${roomId}_${Date.now()}.${ext}`; //set unique filename

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

      const messagesRef = ref(db, `chatrooms/${roomId}/messages`);
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

  // --- NEW: 5. SEND LOCATION LOGIC ---
  const handleSendLocation = async () => {
    setSendingLocation(true);
    try {
      // 1. Request Permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to share your position.');
        setSendingLocation(false);
        return;
      }

      // 2. Get Location
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // 3. Create Google Maps Link
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
      
      const messagesRef = ref(db, `chatrooms/${roomId}/messages`);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 4. Push to Firebase
      await push(messagesRef, {
        text: '📍 Shared Location',
        type: 'location',
        location: { latitude, longitude },
        mapUrl: mapUrl,
        senderId: currentUser.uid,
        time: timestamp,
        timestamp: Date.now(),
      });

    } catch (error) {
      Alert.alert("Error", "Could not fetch location.");
      console.error(error);
    } finally {
      setSendingLocation(false);
    }
  };

  // --- 6. TYPING STATUS ---
  const handleTypingStatus = (isTyping) => {
    update(ref(db, `chatrooms/${roomId}/typing`), {
      [currentUser.uid]: isTyping
    });
  };

  const handleFocus = () => handleTypingStatus(true);
  const handleBlur = () => handleTypingStatus(false);
  
  const handleTextChange = (text) => {
    setInputText(text);
    if (text.length > 0) handleTypingStatus(true);
    else handleTypingStatus(false);
  };

  // --- 7. RENDER ITEM ---
  const renderMessage = ({ item }) => {
    const isMe = item.senderId === currentUser.uid;

    const renderContent = () => {
      if (item.type === 'image') {
        return (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.chatImage} 
            resizeMode="cover"
          />
        );
      } else if (item.type === 'location') {
        return (
          <TouchableOpacity 
            onPress={() => Linking.openURL(item.mapUrl)}
            style={styles.locationContainer}
          >
            <Ionicons name="location-sharp" size={24} color={isMe ? "#fff" : "#5426c0"} />
            <Text style={[
              isMe ? styles.myMessageText : styles.otherMessageText,
              { textDecorationLine: 'underline', marginLeft: 5 }
            ]}>
              View Location
            </Text>
          </TouchableOpacity>
        );
      } else {
        // Text Message
        return (
          <Text style={isMe ? styles.myMessageText : styles.otherMessageText}>
            {item.text}
          </Text>
        );
      }
    };

    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isMe ? styles.myBubble : styles.otherBubble,
          item.type === 'image' && styles.imageBubble 
        ]}>
          
          {renderContent()}

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
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          
          <View style={styles.userInfo}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.nom ? user.nom.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            <View style={styles.userText}>
              <Text style={styles.userName}>{user?.nom || 'Unknown'}</Text>
              <Text style={[
                styles.userStatus, 
                isOtherUserTyping && { color: '#5426c0', fontWeight: 'bold' }
              ]}>
                {isOtherUserTyping ? 'Typing...' : 'En ligne'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{flexDirection:'row', gap: 15}}>
           <TouchableOpacity onPress={() => setMediaModalVisible(true)}>
             <Ionicons name="information-circle-outline" size={26} color="#5426c0" />
           </TouchableOpacity>

           <TouchableOpacity onPress={handleCall}>
             <Ionicons name="call" size={24} color="#5426c0" />
           </TouchableOpacity>
        </View>
      </View>

      {/* CHAT LIST */}
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
        {uploading || sendingLocation ? (
  
           <ActivityIndicator size="small" color="#5426c0" style={{marginRight: 10}}/>
        ) : (
          <>
  
            <TouchableOpacity style={styles.iconButton} onPress={handleSendLocation}>
              <Ionicons name="location" size={28} color="#5426c0" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton} onPress={pickAndSendImage}>
              <Ionicons name="image" size={24} color="#5426c0" />
            </TouchableOpacity>
          </>
        )}

        <TextInput
          style={styles.textInput}
          placeholder="Tapez un message..."
          value={inputText}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
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
  userInfo: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#5426c0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  userText: { justifyContent:'center' },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  userStatus: { fontSize: 12, color: '#4CAF50' },
  
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },
  messageContainer: { marginVertical: 4, flexDirection: 'row' },
  myMessage: { justifyContent: 'flex-end' },
  otherMessage: { justifyContent: 'flex-start' },
  
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 18, marginBottom: 4 },
  imageBubble: { padding: 5, borderRadius: 10, overflow:'hidden' }, 
  myBubble: { backgroundColor: '#5426c0', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e0e0e0' },
  
  chatImage: { width: 200, height: 200, borderRadius: 10 },
  // --- NEW: Location Bubble Styles ---
  locationContainer: { flexDirection: 'row', alignItems: 'center' },

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

export default ChatScreen;