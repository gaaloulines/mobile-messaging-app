import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, Image, Platform, Linking, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import { getDatabase, ref, onValue } from 'firebase/database'
// Import 'auth' to get the current user's ID
import { app, auth } from '../../config/index.js' 
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'

const List = () => {
  const [data, setData] = useState([])
  const [filteredData, setFilteredData] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigation = useNavigation()

  // Get current user ID
  const currentUserId = auth.currentUser?.uid

  useEffect(() => {
    const db = getDatabase(app)
    const ref_all_accounts = ref(db, 'all_accounts')

    const unsubscribe = onValue(ref_all_accounts, (snapshot) => {
      const accounts = []
      
      snapshot.forEach((childSnapshot) => {
        const accountKey = childSnapshot.key
        const accountData = childSnapshot.val()

        // FILTER: Only add the account if the Key (UID) is NOT the current user
        if (accountKey !== currentUserId) {
          accounts.push({
            id: accountKey,
            ...accountData
          })
        }
      })
      
      setData(accounts)
      setFilteredData(accounts)
      setLoading(false)
    })

    return () => unsubscribe()
  }, []) 

  // Search function
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(data)
    } else {
      const filtered = data.filter(item => 
        item.nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.pseudo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.number?.includes(searchQuery)
      )
      setFilteredData(filtered)
    }
  }, [searchQuery, data])

  // --- UPDATED CALL FUNCTION ---
  const handleCall = (phoneNumber) => {
    if (phoneNumber && phoneNumber.length > 0) {
      // Use the 'tel:' scheme to open the dialer
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert("Unavailable", "This contact does not have a phone number saved.");
    }
  }

  const handleMessage = (user) => {
    navigation.navigate('Chat', { 
      user: user 
    })
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading contacts...</Text>
      </View>
    )
  }

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.avatarContainer}>
        {item.picture ? (
          <Image source={{ uri: item.picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.nom ? item.nom.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.nom || 'No Name'}</Text>
        <Text style={styles.pseudo}>@{item.pseudo || 'No Username'}</Text>
        {item.number ? (
          <View style={styles.phoneContainer}>
            <Ionicons name="call-outline" size={14} color="#666" />
            <Text style={styles.number}>{item.number}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => handleCall(item.number)}
        >
          <Ionicons name="call" size={24} color="#4CAF50" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => handleMessage(item)}
        >
          <Ionicons name="chatbubble" size={24} color="#5426c0" />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contacts ({filteredData.length})</Text>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList 
        data={filteredData}
        style={styles.list}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No contacts found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 40 : 60, 
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333'
  },
  list: {
    width: "100%",
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 12
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5426c0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#333'
  },
  pseudo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  number: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa'
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
    fontWeight: '500'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  }
})

export default List