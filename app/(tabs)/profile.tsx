import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Modal, ActivityIndicator, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ChevronRight, Music, Users, Shield,
  Bell, HelpCircle, LogOut, CheckCircle2, Pencil,
  Play, Pause, Eye, Settings2, X, Trophy, Search 
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/constants/themeHelper';

// Audio & Firebase
import { playPreview, stopPreview, getStatus } from '@/services/audioService';
import { useAuth } from '@/auth/AuthContext';
import { userService } from '@/services/userService';
import { eventService } from '@/services/eventService';
import UnifiedProfileView from '@/components/unifiedProfileView';
import EditProfile from '@/components/settings/editProfile';
import MusicDNA from '@/components/musicDNA';
import DatingPreferences from '@/components/settings/DatingPreferences';
import PrivacySafety from '@/components/settings/PrivacySafety';
import Notifications from '@/components/settings/Notifications';
import HelpSupport from '@/components/settings/HelpSupport';

const { width } = Dimensions.get('window');

type ActiveScreen = 'Edit' | 'Music' | 'Dating' | 'Privacy' | 'Notifications' | 'Support' | 'AnthemSelector' | null;

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { user, profile, logout, refreshProfile } = useAuth();

  const [activeSettingScreen, setActiveSettingScreen] = useState<ActiveScreen>(null);
  const [showExpandedProfile, setShowExpandedProfile] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const [selectedAnthemId, setSelectedAnthemId] = useState<number | null>(null);
  const [isSavingAnthem, setIsSavingAnthem] = useState(false);


  const [anthemQuery, setAnthemQuery] = useState('');

  // Filter topSongs based on search query
  const filteredAnthems = useMemo(() => {
    if (!profile?.topSongs) return [];
    if (!anthemQuery.trim()) return profile.topSongs;
    const lowerQ = anthemQuery.toLowerCase();
    return profile.topSongs.filter((t: any) =>
      t.trackName?.toLowerCase().includes(lowerQ) ||
      t.artistName?.toLowerCase().includes(lowerQ)
    );
  }, [profile?.topSongs, anthemQuery]);

  useEffect(() => {
    if (activeSettingScreen === 'AnthemSelector') {
      setSelectedAnthemId(profile?.mainTrackId || null);
      setAnthemQuery(''); // Reset search when opening modal
    }
  }, [activeSettingScreen, profile?.mainTrackId]);

  const handleSaveAnthem = async () => {
    if (!selectedAnthemId) return;

    const selectedTrack = profile?.topSongs?.find((t: any) => t.trackId === selectedAnthemId);
    if (!selectedTrack) return;

    setIsSavingAnthem(true);
    try {
      const safeArtwork = selectedTrack.artworkUrl100 || selectedTrack.mainMusicArt || selectedTrack.mainMusicImage || selectedTrack.image || '';
      const highResArt = safeArtwork.includes('100x100bb') ? safeArtwork.replace('100x100bb', '600x600bb') : safeArtwork;

      const payload = {
        mainTrackId: selectedTrack.trackId,
        mainMusicTitle: selectedTrack.trackName,
        mainMusicArtist: selectedTrack.artistName,
        mainMusicArt: highResArt,
        mainMusicImage: highResArt,
        mainMusicPreview: selectedTrack.previewUrl
      };

  
      await userService.updateUserProfile(user!.uid, payload);
      const anthemChanged = selectedTrack.trackId !== profile?.mainTrackId;
      if (anthemChanged) {
        await eventService.broadcastMusicUpdate(
          { uid: user!.uid, name: profile?.name || 'Your match' },
          selectedTrack,
          'anthem'
        );
      }

      // 3. Refresh and close
      await refreshProfile();
      setActiveSettingScreen(null);
    } catch (error) {
      console.error("Failed to update anthem");
    } finally {
      setIsSavingAnthem(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopPreview();
        setIsPlaying(false);
        setProgress(0);
      };
    }, [])
  );

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(async () => {
        const status = await getStatus();
        if (status) {
          setProgress(status.position / status.duration);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
          }
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleTogglePlay = async () => {
    const previewUrl = profile?.mainMusicPreview;
    if (isPlaying) {
      await stopPreview();
    } else if (previewUrl) {
      await playPreview(previewUrl);
    }
    setIsPlaying(!isPlaying);
  };

  const SettingRow = ({ icon: Icon, label, color, onPress, last }: any) => (
    <TouchableOpacity
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.text + '10' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: color + '15' }]}>
          <Icon size={18} color={color} />
        </View>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <ChevronRight size={18} color={colors.text} opacity={0.3} />
    </TouchableOpacity>
  );

  if (!profile) return (
    <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>


      <View style={styles.header}>
        <Text style={[styles.brandText, { color: colors.text }]}>
          Prof<Text style={{ color: colors.primary }}>ile</Text>
        </Text>

        <TouchableOpacity
          onPress={() => setActiveSettingScreen('Edit')}
          style={styles.editBtn}
        >
          <Settings2 size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>

        {/* IDENTITY SECTION */}
        <View style={styles.identityCard}>
          <View style={styles.identityInfo}>
            <Text style={[styles.nameText, { color: colors.text }]}>
              {profile.name}, {profile.age}
            </Text>
            <Text style={[styles.subText, { color: colors.text }]}>
              {profile.location || 'Location Not Set'}
            </Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.card }]} onPress={() => setShowExpandedProfile(true)} activeOpacity={0.7}>
            <View style={[styles.actionCircle, { backgroundColor: colors.primary + '10' }]}><Eye size={22} color={colors.primary} /></View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.card }]} onPress={() => setActiveSettingScreen('Edit')} activeOpacity={0.7}>
            <View style={[styles.actionCircle, { backgroundColor: '#FF8C0020' }]}><Pencil size={22} color="#FF8C00" /></View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: colors.card }]} onPress={() => setActiveSettingScreen('Music')} activeOpacity={0.7}>
            <View style={[styles.actionCircle, { backgroundColor: '#1DB95420' }]}><Music size={22} color="#1DB954" /></View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>My DNA</Text>
          </TouchableOpacity>
        </View>

        {/* PLAYER CARD */}
        <View style={styles.settingsGroup}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>Profile Anthem</Text>

          <TouchableOpacity
            style={[styles.playerSection, { backgroundColor: colors.card, borderColor: colors.text + '05', borderWidth: 1 }]}
            onPress={() => setActiveSettingScreen('AnthemSelector')}
            activeOpacity={0.9}
          >
            <View style={styles.playerCardInner}>
              <Image source={{ uri: profile.mainMusicArt || profile.mainMusicImage }} style={styles.playerArt} />

              <View style={styles.playerInfo}>
                <Text style={[styles.playerTrack, { color: colors.text }]} numberOfLines={1}>
                  {profile.mainMusicTitle || 'Select Anthem'}
                </Text>
                <Text style={[styles.playerArtist, { color: colors.text }]} numberOfLines={1}>
                  {profile.mainMusicArtist || 'Search in DNA'}
                </Text>

                <View style={styles.playerControls}>
                  <TouchableOpacity onPress={(e) => {
                    e.stopPropagation();
                    handleTogglePlay();
                  }}>
                    {isPlaying ? <Pause size={28} color={colors.primary} fill={colors.primary} /> : <Play size={28} color={colors.primary} fill={colors.primary} />}
                  </TouchableOpacity>
                  <View style={[styles.miniBarBase, { backgroundColor: colors.text + '10' }]}>
                    <View style={[styles.miniBarFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              </View>
            </View>


            <View style={[styles.fullWidthChangeBtn, { borderTopColor: colors.text + '05' }]}>
              <Text style={[styles.changePillText, { color: colors.primary }]}>Change Anthem</Text>
              <Pencil size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* PREFERENCES GROUP */}
        <View style={styles.settingsGroup}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>Preferences</Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <SettingRow icon={Users} label="Dating Preferences" color="#FF4B4B" onPress={() => setActiveSettingScreen('Dating')} />
            <SettingRow icon={Shield} label="Privacy & Safety" color="#4B7BFF" onPress={() => setActiveSettingScreen('Privacy')} />
            <SettingRow icon={Bell} label="Notifications" color="#FFB800" onPress={() => setActiveSettingScreen('Notifications')} last />
          </View>

          <Text style={[styles.groupTitle, { color: colors.text, marginTop: 25 }]}>Support</Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
            <SettingRow icon={HelpCircle} label="Help & Support" color={colors.text} onPress={() => setActiveSettingScreen('Support')} />
            <SettingRow icon={LogOut} label="Sign Out" color="#FF3B30" onPress={logout} last />
          </View>
        </View>

        <Text style={[styles.version, { color: colors.text }]}>MixMatch • v1.0  </Text>
      </ScrollView>

      {/* --- MODALS --- */}

      <Modal visible={activeSettingScreen === 'Edit'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <EditProfile
          userData={profile}
          onSave={async (d: any) => {
            await userService.updateUserProfile(user!.uid, d);
            await refreshProfile();
            setActiveSettingScreen(null);
          }}
          onClose={() => setActiveSettingScreen(null)}
        />
      </Modal>

      <Modal visible={activeSettingScreen === 'Dating'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <DatingPreferences onClose={() => setActiveSettingScreen(null)} />
      </Modal>

      <Modal visible={activeSettingScreen === 'Privacy'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <PrivacySafety onClose={() => setActiveSettingScreen(null)} />
      </Modal>

      <Modal visible={activeSettingScreen === 'Notifications'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <Notifications onClose={() => setActiveSettingScreen(null)} />
      </Modal>

      <Modal visible={activeSettingScreen === 'Support'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <HelpSupport onClose={() => setActiveSettingScreen(null)} />
      </Modal>

      <Modal visible={activeSettingScreen === 'Music'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <MusicDNA onClose={() => setActiveSettingScreen(null)} />
      </Modal>

      <Modal visible={activeSettingScreen === 'AnthemSelector'} animationType="slide" onRequestClose={() => setActiveSettingScreen(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingBottom: 15 }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 }}>Select Anthem</Text>
              <Text style={{ fontSize: 14, color: colors.text, opacity: 0.5, marginTop: 4 }}>Choose a track from your DNA</Text>
            </View>
            <TouchableOpacity onPress={() => setActiveSettingScreen(null)} style={{ padding: 8, backgroundColor: colors.card, borderRadius: 12 }}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>


          <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
            <Search size={20} color={colors.text} opacity={0.4} />
            <TextInput
              placeholder="Search your DNA..."
              placeholderTextColor={colors.text + '40'}
              style={[styles.searchInput, { color: colors.text }]}
              value={anthemQuery}
              onChangeText={setAnthemQuery}
            />
            {anthemQuery.length > 0 && (
              <TouchableOpacity onPress={() => setAnthemQuery('')}>
                <X size={16} color={colors.text} opacity={0.4} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>

              {filteredAnthems.map((track: any) => {
                const isSelected = track.trackId === selectedAnthemId;
                const safeArtwork = track.artworkUrl100 || track.mainMusicArt || track.mainMusicImage || track.image || '';
                const displayArt = safeArtwork.includes('100x100bb') ? safeArtwork.replace('100x100bb', '300x300bb') : safeArtwork;

                return (
                  <TouchableOpacity
                    key={track.trackId.toString()}
                    style={{ width: '33.33%', padding: 5, marginBottom: 15, alignItems: 'center' }}
                    activeOpacity={0.7}
                    onPress={() => setSelectedAnthemId(track.trackId)}
                  >
                    <View style={{ width: '100%', aspectRatio: 1 }}>

                      <Image
                        source={{ uri: displayArt }}
                        style={{ width: '100%', height: '100%', borderRadius: 16 }}
                        contentFit="cover"
                        transition={200}
                      />


                      {isSelected && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            borderWidth: 3,
                            borderColor: colors.primary,
                            borderRadius: 16
                          }}
                        />
                      )}


                      {isSelected && (
                        <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.primary, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }}>
                          <Trophy size={12} color="white" />
                        </View>
                      )}
                    </View>

                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'center' }} numberOfLines={1}>
                      {track.trackName}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 11, opacity: 0.5, textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
                      {track.artistName}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Show message if no results match search OR DNA is empty */}
              {filteredAnthems.length === 0 && (
                <View style={{ width: '100%', paddingVertical: 40, alignItems: 'center' }}>
                  <Music size={40} color={colors.text} opacity={0.2} style={{ marginBottom: 15 }} />
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', opacity: 0.5 }}>
                    {anthemQuery ? 'No matching tracks' : 'No tracks in your DNA'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Sticky Footer */}
          <View style={[styles.footer, { borderTopColor: colors.text + '05', backgroundColor: colors.background }]}>
            <TouchableOpacity
              disabled={!selectedAnthemId || isSavingAnthem}
              style={[styles.saveBtn, { backgroundColor: selectedAnthemId ? colors.primary : colors.text + '10' }]}
              onPress={handleSaveAnthem}
            >
              {isSavingAnthem ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.saveBtnText, { color: selectedAnthemId ? 'white' : colors.text + '30' }]}>
                  Save Profile Anthem
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={showExpandedProfile} animationType="slide" onRequestClose={() => setShowExpandedProfile(false)}>
        <UnifiedProfileView profile={profile} onClose={() => setShowExpandedProfile(false)} />
      </Modal>


    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 10
  },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: -1.5 },
  editBtn: { padding: 10, borderRadius: 12 },

  identityCard: {
    paddingHorizontal: 25,
    marginTop: 15,
    marginBottom: 25
  },
  profilePhoto: { width: 90, height: 90, borderRadius: 32 },
  pfpBadge: { position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
  identityInfo: { marginLeft: 0 },
  nameText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  subText: {
    fontSize: 16,
    opacity: 0.5,
    marginTop: 4
  },

  actionGrid: { flexDirection: 'row', paddingHorizontal: 25, gap: 12, marginBottom: 30 },
  primaryAction: { flex: 1, height: 105, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(150,150,150,0.08)' },
  actionCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  playerSection: {
    paddingTop: 20,
    borderRadius: 30,
    marginBottom: 30,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8
  },
  changePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  changePillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1 },
  playerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15
  },
  playerArt: { width: 85, height: 85, borderRadius: 20 },
  playerInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  playerTrack: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  fullWidthChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  playerArtist: { fontSize: 14, opacity: 0.5, marginTop: 2 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 12 },
  miniBarBase: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  miniBarFill: { height: '100%' },

  settingsGroup: { paddingHorizontal: 25 },
  groupTitle: {
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 8,
    letterSpacing: 1
  },
  settingsCard: { borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(150,150,150,0.08)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  version: { textAlign: 'center', fontSize: 12, opacity: 0.3, marginTop: 40, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 20, borderTopWidth: 1, position: 'absolute', bottom: 0, left: 0, right: 0 },
  saveBtn: { height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 15,
    height: 45,
    borderRadius: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
});