import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, 
  TouchableOpacity, ActivityIndicator, Alert 
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import MusicPicker from '@/components/musicPicker';
import { ITunesSong } from '@/services/musicService';
import { userService } from '@/services/userService';
import { useAuth } from '@/auth/AuthContext';

interface MusicPreferencesProps {
    onClose: () => void;
}

export default function MusicPreferences({ onClose }: MusicPreferencesProps) {
    const { colors } = useTheme();
    const { user, refreshProfile } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load initial data to pass to the picker
    useEffect(() => {
        async function loadData() {
            if (user?.uid) {
                try {
                    const data = await userService.getUserProfile(user.uid);
                    setUserData(data);
                } catch (error) {
                    console.error("Error loading profile:", error);
                } finally {
                    setLoading(false);
                }
            }
        }
        loadData();
    }, [user]);

    // This handler receives the explicit pinnedTrack object from MusicPicker
    const handleSave = async (songs: ITunesSong[], pinned: ITunesSong) => {
        if (!user?.uid) return;
        
        setIsSaving(true);
        try {
            // Standardized Payload for App-Wide Consistency
            const payload = {
                topSongs: songs,                    // The full DNA array (5-50 songs)
                mainTrackId: pinned.trackId,        // The unique numeric ID 
                mainMusicTitle: pinned.trackName,   // Cached title for quick UI rendering
                mainMusicArt: pinned.artworkUrl100.replace('100x100bb', '600x600bb'), // High-res art
                mainMusicPreview: pinned.previewUrl // Ensure the player has the right URL
            };
            
            // 1. Update the Database
            await userService.updateUserProfile(user.uid, payload);
            
            // 2. IMPORTANT: Refresh the global AuthContext state
            // This ensures profile.tsx sees the changes immediately
            await refreshProfile();
            
            onClose();
        } catch (error) {
            console.error("Save Error:", error);
            Alert.alert("Sync Failed", "We couldn't update your Musical DNA. Check your connection.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.text }]}>Musical DNA</Text>
                    <Text style={[styles.subTitle, { color: colors.text }]}>
                        {isSaving ? "Syncing to cloud..." : "Select 5+ songs to define your vibe"}
                    </Text>
                </View>
                <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.closeBtn}>
                    <X size={28} color={colors.text} />
                </TouchableOpacity>
            </View>

            {loading || isSaving ? (
                <View style={styles.loadingArea}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.text }]}>
                        {isSaving ? "Finalizing Identity..." : "Loading Preferences..."}
                    </Text>
                </View>
            ) : (
                <MusicPicker 
                    onComplete={handleSave} 
                    initialSongs={userData?.topSongs || []}
                    initialPinnedId={userData?.mainTrackId} 
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 25,
        paddingTop: 10,
        paddingBottom: 20
    },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
    subTitle: { fontSize: 13, opacity: 0.5, fontWeight: '600', marginTop: 2 },
    closeBtn: { padding: 5 },
    loadingArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 15, fontWeight: '700', fontSize: 14, opacity: 0.6 }
});