import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, onValue, push, set } from 'firebase/database';
import { auth, app } from '../../../config/index'; 

const GroupListScreen = () => {
  const navigation = useNavigation();
  const db = getDatabase(app);
  const currentUser = auth.currentUser;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // 1. Fetch groups where I am a member
  useEffect(() => {
    const groupsRef = ref(db, 'groups');
    const unsubscribe = onValue(groupsRef, (snapshot) => {
      const data = snapshot.val();
      const myGroups = [];
      
      if (data) {
        Object.keys(data).forEach((key) => {
          const group = data[key];
          // Check if current user ID exists in the members object
          if (group.members && group.members[currentUser.uid]) {
            myGroups.push({ id: key, ...group });
          }
        });
      }
      setGroups(myGroups);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Create a New Group
  const createGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const newGroupRef = push(ref(db, 'groups'));
      await set(newGroupRef, {
        name: newGroupName,
        createdBy: currentUser.uid,
        createdAt: Date.now(),
        members: {
          [currentUser.uid]: true // Add myself as the first member
        }
      });
      
      setModalVisible(false);
      setNewGroupName('');
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.groupCard}
      onPress={() => navigation.navigate('GroupChat', { groupId: item.id, groupName: item.name })}
    >
      <View style={styles.groupIcon}>
        <Ionicons name="people" size={24} color="#fff" />
      </View>
      <View>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembers}>
           {Object.keys(item.members || {}).length} members
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" style={{marginLeft:'auto'}}/>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={32} color="#5426c0" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#5426c0" style={{marginTop: 50}}/>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No groups yet. Create one!</Text>}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Group Name" 
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createGroup} style={styles.createBtn}>
                <Text style={[styles.btnText, {color:'#fff'}]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  groupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 2 },
  groupIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#5426c0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  groupName: { fontSize: 18, fontWeight: '600', color: '#333' },
  groupMembers: { fontSize: 14, color: '#888' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 50, fontSize: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { padding: 10 },
  createBtn: { backgroundColor: '#5426c0', padding: 10, borderRadius: 8, paddingHorizontal: 20 },
  btnText: { fontSize: 16, fontWeight: '600' }
});

export default GroupListScreen;