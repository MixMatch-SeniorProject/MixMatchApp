import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, FlatList, TouchableOpacity, 
  StyleSheet, ActivityIndicator, Dimensions 
} from 'react-native';
import { Image } from 'expo-image';
import { 
  Search, CheckCircle2, Music, Star, 
  LayoutGrid, Trash2 
} from 'lucide-react-native';
import { searchITunes, ITunesSong } from '@/services/musicService';
import { useTheme } from '@/constants/themeHelper';

const { width } = Dimensions.get('window');

interface MusicPickerProps {
  onComplete: (songs: ITunesSong[], pinnedTrack: ITunesSong) => void;
  initialSongs?: ITunesSong[];
  initialPinnedId?: number;
}

export default function MusicPicker({ onComplete, initialSongs = [], initialPinnedId }: MusicPickerProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'search' | 'dna'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ITunesSong[]>([]);
  const [selected, setSelected] = useState<ITunesSong[]>(initialSongs);
  

  const [pinnedId, setPinnedId] = useState<number | null>(
    initialPinnedId || initialSongs[0]?.trackId || null
  );
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true);
        const data = await searchITunes(query);
        setResults(data);
        setLoading(false);
      } else {
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const toggleSong = (song: ITunesSong) => {
    const isAlreadySelected = selected.find((s) => s.trackId === song.trackId);
    if (isAlreadySelected) {
      const newSelection = selected.filter((s) => s.trackId !== song.trackId);
      setSelected(newSelection);
      // If we remove the pinned song, default pin to the next available song
      if (song.trackId === pinnedId) {
        setPinnedId(newSelection[0]?.trackId || null);
      }
    } else if (selected.length < 50) {
      setSelected([song, ...selected]);
      if (!pinnedId) setPinnedId(song.trackId);
    }
  };

  // FIXED: handleSave now explicitly finds the pinned object by ID
  const handleSave = () => {
    if (selected.length >= 5) {
      const pinnedTrack = selected.find(s => s.trackId === pinnedId) || selected[0];
      if (pinnedTrack) {
        onComplete(selected, pinnedTrack);
      }
    }
  };

  const renderSearchResult = ({ item }: { item: ITunesSong }) => {
    const isSelected = selected.some(s => s.trackId === item.trackId);
    return (
      <TouchableOpacity 
        style={[styles.resultCard, { backgroundColor: colors.card }]} 
        onPress={() => toggleSong(item)}
      >
        <Image source={{ uri: item.artworkUrl100 }} style={styles.artLarge} />
        <View style={styles.songMeta}>
          <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>{item.trackName}</Text>
          <Text style={[styles.songSub, { color: colors.text }]} numberOfLines={1}>{item.artistName}</Text>
        </View>
        <View style={styles.actionZone}>
          {isSelected ? (
             <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                <CheckCircle2 size={16} color="white" />
             </View>
          ) : (
            <View style={[styles.plusCircle, { borderColor: colors.text + '20' }]}>
               <Music size={16} color={colors.text} opacity={0.5} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'search' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('search')}
        >
          <Search size={20} color={activeTab === 'search' ? colors.primary : colors.text} />
          <Text style={[styles.tabText, { color: activeTab === 'search' ? colors.primary : colors.text }]}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dna' && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab('dna')}
        >
          <LayoutGrid size={20} color={activeTab === 'dna' ? colors.primary : colors.text} />
          <Text style={[styles.tabText, { color: activeTab === 'dna' ? colors.primary : colors.text }]}>My DNA ({selected.length})</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'search' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
            <Search size={20} color={colors.text} opacity={0.4} />
            <TextInput
              placeholder="Find your vibe..."
              placeholderTextColor={colors.text + '40'}
              style={[styles.input, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
            />
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <FlatList
            data={results}
            renderItem={renderSearchResult}
            keyExtractor={item => item.trackId.toString()}
            contentContainerStyle={styles.listPadding}
          />
        </View>
      ) : (
        <FlatList
          data={selected}
          keyExtractor={(item) => `dna-${item.trackId}`}
          renderItem={({ item }) => (
            <View style={[styles.dnaRow, { borderBottomColor: colors.text + '05' }]}>
              <TouchableOpacity style={styles.dnaInfo} onPress={() => setPinnedId(item.trackId)}>
                <Image source={{ uri: item.artworkUrl100 }} style={styles.dnaArt} />
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={[styles.dnaTitle, { color: colors.text }]} numberOfLines={1}>{item.trackName}</Text>
                  <Text style={[styles.dnaArtist, { color: colors.text }]} numberOfLines={1}>{item.artistName}</Text>
                </View>
                {pinnedId === item.trackId && (
                    <View style={[styles.identityBadge, { backgroundColor: colors.primary }]}>
                        <Star size={10} color="white" fill="white" />
                        <Text style={styles.identityText}>PINNED</Text>
                    </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleSong(item)} style={styles.dnaRemove}>
                <Trash2 size={18} color={colors.text} opacity={0.3} />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 150 }}
        />
      )}

      <View style={[styles.footer, { borderTopColor: colors.text + '05' }]}>
        <TouchableOpacity 
          disabled={selected.length < 5}
          style={[styles.saveBtn, { backgroundColor: selected.length >= 5 ? colors.primary : colors.text + '10' }]}
          onPress={handleSave}
        >
          <Text style={[styles.saveBtnText, { color: selected.length >= 5 ? 'white' : colors.text + '30' }]}>
            Update Musical DNA
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  tabText: { fontWeight: '700', fontSize: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, paddingHorizontal: 15, height: 55, borderRadius: 15, marginBottom: 15 },
  input: { flex: 1, marginLeft: 12, fontSize: 16 },
  listPadding: { paddingHorizontal: 20, paddingBottom: 150 },
  resultCard: { flexDirection: 'row', padding: 12, borderRadius: 20, marginBottom: 12, alignItems: 'center' },
  artLarge: { width: 70, height: 70, borderRadius: 12 },
  songMeta: { flex: 1, marginLeft: 15 },
  songTitle: { fontSize: 16, fontWeight: '800' },
  songSub: { fontSize: 12, opacity: 0.6 },
  actionZone: { marginLeft: 10 },
  plusCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  checkCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dnaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginHorizontal: 20, borderBottomWidth: 1 },
  dnaInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dnaArt: { width: 50, height: 50, borderRadius: 10 },
  dnaTitle: { fontSize: 15, fontWeight: '700' },
  dnaArtist: { fontSize: 13, opacity: 0.5 },
  dnaRemove: { padding: 10 },
  identityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 10 },
  identityText: { color: 'white', fontSize: 9, fontWeight: '900' },
  footer: { padding: 25, borderTopWidth: 1 },
  saveBtn: { height: 60, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800' }
});