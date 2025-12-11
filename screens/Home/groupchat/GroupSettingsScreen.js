import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, get, update, remove } from 'firebase/database';
import { auth, app } from '../../../config/index'; 

const GroupSettingsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { groupId, groupName } = route.params; // Get ID from params
  const db = getDatabase(app);
  const currentUser = auth.currentUser;

  const [members, setMembers] = useState([]);
  const [nonMembers, setNonMembers] = useState([]); // People we can add
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchGroupData();
  }, []);

  const fetchGroupData = async () => {
    try {
      // 1. Get Group Info (to check admin)
      const groupSnapshot = await get(ref(db, `groups/${groupId}`));
      const groupData = groupSnapshot.val();
      
      if (!groupData) return;
      setIsAdmin(groupData.createdBy === currentUser.uid);
      const memberIds = Object.keys(groupData.members || {});

      // 2. Get All Accounts
      const usersSnapshot = await get(ref(db, 'all_accounts'));
      const allUsers = usersSnapshot.val();

      const memberList = [];
      const nonMemberList = [];

      Object.keys(allUsers).forEach(uid => {
        const user = { id: uid, ...allUsers[uid] };
        if (memberIds.includes(uid)) {
          memberList.push(user);
        } else {
          nonMemberList.push(user);
        }
      });

      setMembers(memberList);
      setNonMembers(nonMemberList);
    } catch (error) {
      console.error(error);
    }
  };

  const addUser = async (userId) => {
    try {
      await update(ref(db, `groups/${groupId}/members`), {
        [userId]: true
      });
      Alert.alert("Success", "User added!");
      fetchGroupData(); // Refresh list
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const removeUser = async (userId) => {
    try {
      await remove(ref(db, `groups/${groupId}/members/${userId}`));
      Alert.alert("Removed", "User removed from group.");
      fetchGroupData();
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const leaveGroup = async () => {
    Alert.alert("Leave Group", "Are you sure?", [
        { text: "Cancel" },
        { text: "Leave", style: 'destructive', onPress: async () => {
            await remove(ref(db, `groups/${groupId}/members/${currentUser.uid}`));
            navigation.popToTop(); // Go back to List
        }}
    ]);
  };

  const deleteGroup = async () => {
    Alert.alert("Delete Group", "This will delete the group for everyone.", [
        { text: "Cancel" },
        { text: "Delete", style: 'destructive', onPress: async () => {
            await remove(ref(db, `groups/${groupId}`));
            await remove(ref(db, `chatrooms/${groupId}`)); // Clean up messages
            navigation.popToTop();
        }}
    ]);
  };

  const renderUserItem = ({ item, isMember }) => (
    <View style={styles.userRow}>
      <Image source={item.picture ? { uri: item.picture } : require('../../../assets/profile.jpeg')} style={styles.avatar} />
      <Text style={styles.userName}>{item.nom || 'User'}</Text>
      
      {/* Logic for Buttons */}
      {isAdmin && isMember && item.id !== currentUser.uid && (
         <TouchableOpacity onPress={() => removeUser(item.id)}>
             <Ionicons name="remove-circle" size={28} color="#e74c3c" />
         </TouchableOpacity>
      )}
      
      {isAdmin && !isMember && (
         <TouchableOpacity onPress={() => addUser(item.id)}>
             <Ionicons name="add-circle" size={28} color="#27ae60" />
         </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Manage: {groupName}</Text>

      <Text style={styles.sectionTitle}>Members ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={item => item.id}
        renderItem={({item}) => renderUserItem({item, isMember: true})}
        style={{maxHeight: 250}}
      />

      {isAdmin && (
        <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Add People</Text>
            <FlatList
                data={nonMembers}
                keyExtractor={item => item.id}
                renderItem={({item}) => renderUserItem({item, isMember: false})}
            />
        </>
      )}

      <View style={styles.footer}>
          {isAdmin ? (
              <TouchableOpacity style={styles.deleteBtn} onPress={deleteGroup}>
                  <Text style={styles.btnText}>Delete Group</Text>
              </TouchableOpacity>
          ) : (
              <TouchableOpacity style={styles.leaveBtn} onPress={leaveGroup}>
                  <Text style={styles.btnText}>Leave Group</Text>
              </TouchableOpacity>
          )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign:'center', marginTop: 40 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 10, marginTop: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10, backgroundColor:'#ddd' },
  userName: { flex: 1, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#ccc', marginVertical: 15 },
  footer: { marginTop: 20, alignItems: 'center' },
  deleteBtn: { backgroundColor: '#e74c3c', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center' },
  leaveBtn: { backgroundColor: '#f39c12', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default GroupSettingsScreen;