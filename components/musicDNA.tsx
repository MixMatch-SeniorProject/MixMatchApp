import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    TextInput, FlatList, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { X, Search, CheckCircle2, Music, Star, LayoutGrid, Trash2, Trophy } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { searchITunes, ITunesSong } from '@/services/musicService';
import { userService } from '@/services/userService';
import { useAuth } from '@/auth/AuthContext';
import { eventService } from '@/services/eventService';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

interface MusicDNAProps {
    onClose: () => void;
}

export default function MusicDNA({ onClose }: MusicDNAProps) {
    const { colors } = useTheme();
    const { user, profile, refreshProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<'search' | 'dna'>('search');
    const [query, setQuery] = useState('');
    const [dnaQuery, setDnaQuery] = useState('');
    const [results, setResults] = useState<ITunesSong[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);


    const [selected, setSelected] = useState<ITunesSong[]>(profile?.topSongs || []);
    const [pinnedId, setPinnedId] = useState<number | null>(profile?.mainTrackId || null);

    // Persistent Anthem Logic
    const currentAnthem = useMemo(() => {
        const localMatch = selected.find(s => s.trackId === pinnedId);
        if (localMatch) return localMatch;

        if (profile?.mainMusicTitle) {
            return {
                trackId: profile.mainTrackId,
                trackName: profile.mainMusicTitle,
                artistName: profile.mainMusicArtist,
                artworkUrl100: profile.mainMusicArt || profile.mainMusicImage,
                previewUrl: profile.mainMusicPreview
            } as ITunesSong;
        }
        return null;
    }, [selected, pinnedId, profile]);

    // 1. Search Logic (API)
    useEffect(() => {
        if (activeTab !== 'search') return;

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
    }, [query, activeTab]);

    // DNA Local Search Logic
    const filteredDNA = useMemo(() => {
        if (!dnaQuery.trim()) return selected;
        const lowerQ = dnaQuery.toLowerCase();
        return selected.filter(s =>
            s.trackName.toLowerCase().includes(lowerQ) ||
            s.artistName.toLowerCase().includes(lowerQ)
        );
    }, [selected, dnaQuery]);

    // 2. Selection & Pinning Logic
    const toggleSong = (song: ITunesSong) => {
        const isAlreadySelected = selected.find((s) => s.trackId === song.trackId);
        if (isAlreadySelected) {
            const newSelection = selected.filter((s) => s.trackId !== song.trackId);
            setSelected(newSelection);

            // If they deselect their current anthem, pass the crown to the next song or null
            if (song.trackId === pinnedId) {
                setPinnedId(newSelection[0]?.trackId || null);
            }
        } else if (selected.length < 50) {
            // Just add to the DNA list, don't force it to be the anthem!
            setSelected([song, ...selected]);
        }
    };

    const quickPin = (song: ITunesSong) => {
        const isSelected = selected.some(s => s.trackId === song.trackId);
        if (!isSelected) {
            setSelected([song, ...selected]);
        }
        setPinnedId(song.trackId);
    };

    // 3. Save Logic
    const handleSave = async () => {
        if (!user?.uid || selected.length < 5) {
            Alert.alert("Almost there!", "Please select at least 5 songs to save your DNA.");
            return;
        }

        // Use the memoized currentAnthem! It already knows if you have a saved one.
        if (!currentAnthem) {
            Alert.alert("Pick an Anthem!", "Please tap the Trophy icon next to a song to set it as your Active Anthem before saving.");
            return;
        }

        setIsSaving(true);
        try {
            const highResArt = currentAnthem.artworkUrl100.replace('100x100bb', '600x600bb');
            const extractedGenres = Array.from(new Set(selected.map((s: any) => s.primaryGenreName).filter(Boolean)));
            const extractedArtists = Array.from(new Set(selected.map(s => s.artistName).filter(Boolean)));

            const payload = {
                topSongs: selected,
                mainTrackId: currentAnthem.trackId,
                mainMusicTitle: currentAnthem.trackName,
                mainMusicArtist: currentAnthem.artistName,
                mainMusicArt: highResArt,
                mainMusicImage: highResArt,
                mainMusicPreview: currentAnthem.previewUrl,
                favoriteGenres: extractedGenres,
                favoriteArtists: extractedArtists
            };

            await userService.updateUserProfile(user.uid, payload);

            // 1. Did the anthem change?
            const anthemChanged = currentAnthem.trackId !== profile?.mainTrackId;

            // 2. Did the DNA playlist change? (Quickly compare the IDs)
            const oldPlaylistIds = profile?.topSongs?.map((s: any) => s.trackId).join(',') || '';
            const newPlaylistIds = selected.map(s => s.trackId).join(',');
            const playlistChanged = oldPlaylistIds !== newPlaylistIds;

            // 3. ONLY broadcast if an actual change occurred!
            if (anthemChanged || playlistChanged) {

                // If the anthem changed, show the anthem. 
                // If it was just a playlist update, show the newest song they just added!
                const featuredTrack = anthemChanged ? currentAnthem : selected[0];

                await eventService.broadcastMusicUpdate(
                    { uid: user.uid, name: profile?.name || 'Your match' },
                    featuredTrack,
                    anthemChanged ? 'anthem' : 'playlist'
                );
            }

            await refreshProfile();
            onClose();
        } catch (error) {
            Alert.alert("Sync Failed", "We couldn't update your Musical DNA.");
        } finally {
            setIsSaving(false);
        }
    };
    const renderRightActions = (onRemove: () => void) => (
        <TouchableOpacity style={[styles.deleteAction, { backgroundColor: colors.danger }]} onPress={onRemove} activeOpacity={0.8}>
            <Trash2 size={20} color="white" />
            <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: colors.text }]}>Musical DNA</Text>
                        <Text style={[styles.subTitle, { color: colors.text }]}>
                            {isSaving ? "Syncing..." : "Your identity, amplified."}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.closeBtn}>
                        <X size={28} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* PERSISTENT ANTHEM DASHBOARD */}
                <View style={styles.dashboardContainer}>
                    {currentAnthem ? (
                        <View style={[styles.pinnedBanner, { backgroundColor: colors.card, borderColor: colors.primary + '30' }]}>
                            <Image source={{ uri: currentAnthem.artworkUrl100 }} style={styles.pinnedArt} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={styles.pinnedTag}>
                                    <Trophy size={10} color={colors.primary} fill={colors.primary} />
                                    <Text style={[styles.pinnedTagText, { color: colors.primary }]}>ACTIVE ANTHEM</Text>
                                </View>
                                <Text style={[styles.pinnedName, { color: colors.text }]} numberOfLines={1}>{currentAnthem.trackName}</Text>
                                <Text style={[styles.pinnedArtist, { color: colors.text }]} numberOfLines={1}>{currentAnthem.artistName}</Text>
                            </View>
                            <View style={[styles.statusIcon, { backgroundColor: colors.primary }]}>
                                <Music size={12} color="white" />
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.pinnedBanner, { backgroundColor: colors.card, borderStyle: 'dashed', opacity: 0.6 }]}>
                            <View style={[styles.pinnedArt, { backgroundColor: colors.text + '10', justifyContent: 'center', alignItems: 'center' }]}>
                                <Music size={20} color={colors.text} opacity={0.2} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.pinnedName, { color: colors.text }]}>No Anthem Set</Text>
                                <Text style={[styles.pinnedArtist, { color: colors.text }]}>Search below to pick one</Text>
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.tabContainer}>
                    <TabButton
                        active={activeTab === 'search'}
                        label="Discover"
                        icon={<Search size={18} color={activeTab === 'search' ? colors.primary : colors.text} />}
                        onPress={() => setActiveTab('search')}
                        colors={colors}
                    />
                    <TabButton
                        active={activeTab === 'dna'}
                        label={`My DNA (${selected.length})`}
                        icon={<LayoutGrid size={18} color={activeTab === 'dna' ? colors.primary : colors.text} />}
                        onPress={() => setActiveTab('dna')}
                        colors={colors}
                    />
                </View>

                <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
                    <Search size={22} color={colors.text} opacity={0.4} />
                    <TextInput
                        placeholder={activeTab === 'search' ? "Search for a song..." : "Search your DNA..."}
                        placeholderTextColor={colors.text + '40'}
                        style={[styles.input, { color: colors.text }]}
                        value={activeTab === 'search' ? query : dnaQuery}
                        onChangeText={activeTab === 'search' ? setQuery : setDnaQuery}
                    />
                    {activeTab === 'search' && loading && <ActivityIndicator size="small" color={colors.primary} />}
                </View>

                <View style={{ flex: 1 }}>
                    {activeTab === 'search' ? (
                        <FlatList
                            data={results}
                            keyExtractor={item => item.trackId.toString()}
                            renderItem={({ item }) => (
                                <SearchResultCard
                                    item={item}
                                    isSelected={selected.some(s => s.trackId === item.trackId)}
                                    isPinned={pinnedId === item.trackId}
                                    onPress={() => toggleSong(item)}
                                    onPin={() => quickPin(item)}
                                    colors={colors}
                                />
                            )}
                            contentContainerStyle={styles.listPadding}
                        />
                    ) : (
                        <FlatList
                            data={filteredDNA}
                            keyExtractor={(item) => `dna-${item.trackId}`}
                            renderItem={({ item }) => (
                                <Swipeable renderRightActions={() => renderRightActions(() => toggleSong(item))}>
                                    <DnaCard
                                        item={item}
                                        isPinned={pinnedId === item.trackId}
                                        onPin={() => setPinnedId(item.trackId)}
                                        colors={colors}
                                    />
                                </Swipeable>
                            )}
                            contentContainerStyle={styles.listPadding}
                            ListEmptyComponent={
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Music size={40} color={colors.text} opacity={0.2} style={{ marginBottom: 15 }} />
                                    <Text style={{ color: colors.text, opacity: 0.5, fontWeight: '600' }}>No songs found in DNA</Text>
                                </View>
                            }
                        />
                    )}
                </View>

                <View style={[styles.footer, { borderTopColor: colors.text + '05', backgroundColor: colors.background }]}>
                    <TouchableOpacity
                        disabled={selected.length < 5 || isSaving}
                        style={[styles.saveBtn, { backgroundColor: selected.length >= 5 ? colors.primary : colors.text + '10' }]}
                        onPress={handleSave}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={[styles.saveBtnText, { color: selected.length >= 5 ? 'white' : colors.text + '30' }]}>
                                {selected.length < 5 ? `Select ${5 - selected.length} more` : "Save Profile Changes"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}



const TabButton = ({ active, label, icon, onPress, colors }: any) => (
    <TouchableOpacity
        style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
        onPress={onPress}
    >
        {icon}
        <Text style={[styles.tabText, { color: active ? colors.primary : colors.text }]}>{label}</Text>
    </TouchableOpacity>
);

const SearchResultCard = ({ item, isSelected, isPinned, onPress, onPin, colors }: any) => (
    <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={onPress}>
            <Image source={{ uri: item.artworkUrl100 }} style={styles.artLarge} />
            <View style={styles.songMeta}>
                <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>{item.trackName}</Text>
                <Text style={[styles.songSub, { color: colors.text }]} numberOfLines={1}>{item.artistName}</Text>
            </View>
        </TouchableOpacity>

        <View style={styles.actionCluster}>
            <TouchableOpacity onPress={onPin} style={[styles.pinAction, isPinned && { backgroundColor: colors.primary }]}>
                <Trophy size={18} color={isPinned ? 'white' : colors.text} opacity={isPinned ? 1 : 0.4} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onPress} style={isSelected ? [styles.checkCircle, { backgroundColor: colors.primary }] : styles.plusCircle}>
                {isSelected ? <CheckCircle2 size={20} color="white" /> : <Music size={20} color={colors.text} opacity={0.5} />}
            </TouchableOpacity>
        </View>
    </View>
);


const DnaCard = ({ item, isPinned, onPin, colors }: any) => (
    <TouchableOpacity
        style={[styles.dnaCard, { backgroundColor: colors.card, borderColor: colors.text + '10' }]}
        onPress={onPin}
        activeOpacity={0.7}
    >
        <Image source={{ uri: item.artworkUrl100 }} style={styles.dnaArt} />
        <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={[styles.dnaTitle, { color: colors.text }]} numberOfLines={1}>{item.trackName}</Text>
            <Text style={[styles.dnaArtist, { color: colors.text }]} numberOfLines={1}>{item.artistName}</Text>
        </View>
        {isPinned && (
            <View style={[styles.identityBadge, { backgroundColor: colors.primary }]}>
                <Star size={10} color="white" fill="white" />
                <Text style={styles.identityText}>ANTHEM</Text>
            </View>
        )}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 15 },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
    subTitle: { fontSize: 13, opacity: 0.5, fontWeight: '600', marginTop: 2 },
    closeBtn: { padding: 5 },
    dashboardContainer: { paddingHorizontal: 20, marginBottom: 10 },
    pinnedBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, borderWidth: 1 },
    pinnedArt: { width: 50, height: 50, borderRadius: 10 },
    pinnedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    pinnedTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    pinnedName: { fontSize: 15, fontWeight: '800' },
    pinnedArtist: { fontSize: 12, opacity: 0.6 },
    statusIcon: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    tabText: { fontWeight: '700', fontSize: 14 },
    searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, paddingHorizontal: 15, height: 50, borderRadius: 15, marginBottom: 15 },
    input: { flex: 1, marginLeft: 12, fontSize: 16 },
    listPadding: { paddingHorizontal: 20, paddingBottom: 100 },

    resultCard: { flexDirection: 'row', padding: 12, borderRadius: 20, marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' },
    artLarge: { width: 65, height: 65, borderRadius: 12 },
    songMeta: { flex: 1, marginLeft: 15, marginRight: 10 },
    songTitle: { fontSize: 15, fontWeight: '800' },
    songSub: { fontSize: 12, opacity: 0.6, marginTop: 2 },
    actionCluster: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    plusCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(150,150,150,0.2)', justifyContent: 'center', alignItems: 'center' },
    checkCircle: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    pinAction: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(150,150,150,0.1)' },


    deleteAction: { justifyContent: 'center', alignItems: 'center', width: 80, height: '88%', borderRadius: 25, marginLeft: 10, marginTop: 4 },
    actionText: { color: 'white', fontSize: 12, fontWeight: 'bold', marginTop: 4 },


    dnaCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 25, marginBottom: 12, borderWidth: 1 },
    dnaArt: { width: 55, height: 55, borderRadius: 12 },
    dnaTitle: { fontSize: 16, fontWeight: '800' },
    dnaArtist: { fontSize: 14, opacity: 0.6, marginTop: 2 },
    identityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 10 },
    identityText: { color: 'white', fontSize: 8, fontWeight: '900' },

    footer: { padding: 20, borderTopWidth: 1, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
    saveBtn: { height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { fontSize: 16, fontWeight: '800' }
});