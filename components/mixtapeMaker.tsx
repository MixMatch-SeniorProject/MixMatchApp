import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, 
  FlatList, ActivityIndicator,Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Search, X, Plus, ExternalLink, Music, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { db } from '@/services/firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/auth/AuthContext';
import { searchITunes, ITunesSong } from '@/services/musicService';

interface MixtapeMakerProps {
  visible: boolean;
  onClose: () => void;
  chat: any;
}

export default function MixtapeMaker({ visible, onClose, chat }: MixtapeMakerProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ITunesSong[]>([]);
  const [sharedList, setSharedList] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlist' | 'search'>('playlist');

  useEffect(() => {
    if (!chat?.id || !visible) return;
    const unsub = onSnapshot(doc(db, "matches", chat.id), (snap) => {
      if (snap.exists() && snap.data().sharedPlaylist) {
        setSharedList(snap.data().sharedPlaylist);
      }
    });
    return () => unsub();
  }, [chat?.id, visible]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoadingSearch(true);
        const data = await searchITunes(query);
        setResults(data);
        setLoadingSearch(false);
      } else { setResults([]); }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const addSong = async (song: ITunesSong) => {
    if (!user || !chat?.id) return;
    if (sharedList.find(s => s.id === song.trackId)) return;

    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.trackName + " " + song.artistName)}`;
    const songData = {
      id: song.trackId,
      title: song.trackName,
      artist: song.artistName,
      art: song.artworkUrl100,
      url: youtubeUrl
    };

    try {
      await updateDoc(doc(db, "matches", chat.id), { sharedPlaylist: arrayUnion(songData) });
      await addDoc(collection(db, "matches", chat.id, "messages"), {
        type: 'playlist_add',
        song: songData,
        senderId: user.uid,
        timestamp: serverTimestamp()
      });
      setQuery('');
      setActiveTab('playlist');
    } catch (error) {
      console.error("Error adding to mixtape:", error);
    }
  };


  const removeSong = async (song: any) => {
    if (!chat?.id || !user) return;
    try {

      await updateDoc(doc(db, "matches", chat.id), {
        sharedPlaylist: arrayRemove(song)
      });
      

      await addDoc(collection(db, "matches", chat.id, "messages"), {
        type: 'playlist_remove',
        song: song,
        senderId: user.uid,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error removing song:", error);
    }
  };

  const openYouTube = (url: string) => {
    Linking.openURL(url).catch(() => console.error("Couldn't open YouTube"));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Shared Mixtape</Text>
            <Text style={[styles.subTitle, { color: colors.text }]}>
              {sharedList.length} tracks • Curated with {chat?.name}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}><X size={24} color={colors.text} /></TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'playlist' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
            onPress={() => setActiveTab('playlist')}
          >
            <Music size={18} color={activeTab === 'playlist' ? colors.primary : colors.text} />
            <Text style={[styles.tabText, { color: activeTab === 'playlist' ? colors.primary : colors.text }]}>The Mix</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'search' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
            onPress={() => setActiveTab('search')}
          >
            <Search size={18} color={activeTab === 'search' ? colors.primary : colors.text} />
            <Text style={[styles.tabText, { color: activeTab === 'search' ? colors.primary : colors.text }]}>Add Track</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          {activeTab === 'playlist' ? (
            <FlatList
              data={sharedList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item, index }) => (
                <View style={[styles.mixtapeRow, { backgroundColor: colors.card }]}>
                  <Text style={{ color: colors.primary, fontWeight: '900', width: 25 }}>{index + 1}</Text>
                  <Image source={{ uri: item.art }} style={styles.artThumb} />
                  
               
                  <View style={styles.songInfoContainer}>
                    <Text style={[styles.trackName, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.trackArtist, { color: colors.text }]} numberOfLines={1}>{item.artist}</Text>
                  </View>
                  
               
                  <View style={styles.actionContainer}>
                    <TouchableOpacity onPress={() => openYouTube(item.url)} style={styles.actionIcon}>
                      <ExternalLink size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeSong(item)} style={styles.actionIcon}>
                      <Trash2 size={18} color={colors.text} opacity={0.4} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              contentContainerStyle={{ padding: 20 }}
            />
          ) : (
            <View style={{ flex: 1 }}>
              <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
                <Search size={20} color={colors.text} opacity={0.4} />
                <TextInput
                  placeholder="Find the perfect song..."
                  placeholderTextColor={colors.text + '40'}
                  style={[styles.input, { color: colors.text }]}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
                {loadingSearch && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <FlatList
                data={results}
                keyExtractor={item => item.trackId.toString()}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                renderItem={({ item }) => {
                  const isAdded = sharedList.some(s => s.id === item.trackId);
                  return (
                    <TouchableOpacity 
                      style={[styles.resultCard, { backgroundColor: colors.card, opacity: isAdded ? 0.5 : 1 }]} 
                      onPress={() => !isAdded && addSong(item)}
                      disabled={isAdded}
                    >
                      <Image source={{ uri: item.artworkUrl100 }} style={styles.artThumb} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>{item.trackName}</Text>
                        <Text style={[styles.songSub, { color: colors.text }]} numberOfLines={1}>{item.artistName}</Text>
                      </View>
                      <View style={[styles.addButton, { backgroundColor: isAdded ? colors.text + '20' : colors.primary }]}>
                        {isAdded ? <Text style={{ fontSize: 10, fontWeight: 'bold' }}>ADDED</Text> : <Plus size={16} color="white" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '900' },
  subTitle: { fontSize: 13, opacity: 0.5, fontWeight: '600' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  tabText: { fontWeight: '700', fontSize: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, paddingHorizontal: 15, height: 50, borderRadius: 15, marginBottom: 15 },
  input: { flex: 1, marginLeft: 12, fontSize: 16 },
  resultCard: { flexDirection: 'row', padding: 10, borderRadius: 15, marginBottom: 10, alignItems: 'center' },
  artThumb: { width: 45, height: 45, borderRadius: 8 },
  songTitle: { fontSize: 15, fontWeight: '700' },
  songSub: { fontSize: 12, opacity: 0.5 },
  addButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },


  mixtapeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 10 
  },
  songInfoContainer: { 
    flex: 1, 
    marginLeft: 12, 
    marginRight: 10 
  },
  trackName: { 
    fontSize: 15, 
    fontWeight: '800' 
  },
  trackArtist: { 
    fontSize: 12, 
    opacity: 0.6 
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15
  },
  actionIcon: {
    padding: 5
  }
});