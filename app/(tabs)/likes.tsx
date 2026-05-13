import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Modal, Alert,
  RefreshControl, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  House, Heart, X, Users,
  Settings2, Trash2, HeartCrack, Pencil,
} from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/auth/AuthContext';
import { matchService } from '@/services/matchService';

import UnifiedProfileView from '@/components/unifiedProfileView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const cardSize = (SCREEN_WIDTH - 45) / 2;

const CONTAINER_WIDTH = SCREEN_WIDTH - 50;
const PILL_PADDING = 4;
const TAB_WIDTH = (CONTAINER_WIDTH - (PILL_PADDING * 2)) / 2;
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function LikesScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  const [mainTab, setMainTab] = useState<'Likes' | 'Matches'>('Likes');
  const [isEditMode, setIsEditMode] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isEditMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(wiggleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        ])
      ).start();
    } else {
      wiggleAnim.setValue(0);
      wiggleAnim.stopAnimation();
    }
  }, [isEditMode, wiggleAnim]);

  const fetchConnections = async (showLoading = true) => {
    if (!user) return;
    if (showLoading && !refreshing) setLoading(true);

    try {
      const { likedYou, matches: mutualMatches } = await matchService.getConnectionProfiles(user.uid);
      setProfiles(likedYou);
      setMatches(mutualMatches);
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConnections(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchConnections(false);
    }, [user])
  );

  // --- Tab Switching Logic ---
  const switchTab = (tab: 'Likes' | 'Matches', index: number) => {
    if (mainTab === tab) return;

    setMainTab(tab);
    setIsEditMode(false);

    Animated.spring(slideAnim, {
      toValue: index,
      useNativeDriver: true,
      bounciness: 8,
      speed: 12
    }).start();

    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    const newTab = index === 0 ? 'Likes' : 'Matches';

    if (mainTab !== newTab) {
      setMainTab(newTab);
      setIsEditMode(false);
      Animated.spring(slideAnim, {
        toValue: index,
        useNativeDriver: true,
        bounciness: 8,
        speed: 12
      }).start();
    }
  };

  // --- Actions ---
  const handleCardPress = (profile: any) => {
    if (isEditMode) return;

    // Override the profile's live mode with the STAMPED mode so the 
    // UnifiedProfileView header respects the interaction context!
    const profileWithStampedIntent = {
      ...profile,
      mode: profile.connectionMode === 'Friend' ? ['Friends'] : ['Dating']
    };

    setSelectedProfile(profileWithStampedIntent);
    setIsModalVisible(true);
  };

  const handleRemoveConnection = (targetProfile: any, isMatch: boolean) => {
    const title = isMatch ? "Unmatch User?" : "Remove Like?";
    const message = isMatch
      ? `Are you sure you want to unmatch ${targetProfile.name}? You will both reappear in discovery.`
      : `Remove ${targetProfile.name}'s like? This cannot be undone.`;

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await matchService.removeConnection(user!.uid, targetProfile.id, isMatch ? 'match' : 'like');
            if (isMatch) {
              setMatches(prev => prev.filter(p => p.id !== targetProfile.id));
            } else {
              setProfiles(prev => prev.filter(p => p.id !== targetProfile.id));
            }
          } catch (e) {
            Alert.alert("Error", "Failed to remove connection.");
          }
        }
      }
    ]);
  };

  const handleMatchAction = async (action: 'like' | 'pass') => {
    if (!user || !selectedProfile) return;
    try {
      const interactionMode = selectedProfile.mode?.includes('Dating') ? 'Date' : 'Friend';
      const result = await matchService.recordInteraction(user.uid, selectedProfile.id, action, interactionMode);

      setIsModalVisible(false);
      if (mainTab === 'Likes') {
        setProfiles(prev => prev.filter(p => p.id !== selectedProfile.id));
      }
      if (action === 'like' && result.match) {
        Alert.alert("It's a Match! 🎉", `You and ${selectedProfile.name} matched.`);
        fetchConnections(false);
      }
    } catch (error) {
      console.error("Error recording match action", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // --- Render Helper for Pages ---
  const renderPage = (tabName: 'Likes' | 'Matches', dataPool: any[]) => {
    const isMatchTab = tabName === 'Matches';

    return (
      <ScrollView
        key={tabName}
        style={{ width: SCREEN_WIDTH }}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {dataPool.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyTitle}>No {tabName} Yet</Text>
            <Text style={styles.emptySubtitle}>
              {isMatchTab ? "Mutual likes will appear here." : "Swipe more to see who likes your vibe!"}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {dataPool.map((profile, index) => {
              const isFriend = profile.connectionMode === 'Friend';

              const wiggleRotation = wiggleAnim.interpolate({
                inputRange: [-1, 1],
                outputRange: index % 2 === 0 ? ['-2deg', '2deg'] : ['2deg', '-2deg']
              });

              return (
                <AnimatedTouchable
                  key={profile.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },

                    isEditMode && { transform: [{ rotate: wiggleRotation }] }
                  ]}
                  activeOpacity={0.9}
                  onPress={() => handleCardPress(profile)}
                  onLongPress={() => setIsEditMode(true)} 
                  delayLongPress={400} 
                >
                  <Image
                    source={{ uri: profile.mainMusicArt || profile.mainMusicImage || profile.image || profile.photos?.[0] }}
                    style={styles.cardImage}
                    contentFit="cover"
                  />

                  {isEditMode && (
                    <TouchableOpacity
                      style={styles.removeOverlay}
                      activeOpacity={0.8}
                      onPress={() => handleRemoveConnection(profile, isMatchTab)}
                    >
                      <View style={styles.removeCircle}>
                        {isMatchTab ? <Trash2 size={24} color="#FF3B30" /> : <HeartCrack size={24} color="#FF3B30" />}
                      </View>
                    </TouchableOpacity>
                  )}

                  {!isEditMode && (
                    <>
                      <View style={styles.gradientOverlay} />

                      <View style={styles.intentTag}>
                        {isFriend ? <Users size={10} color="white" /> : <Heart size={10} color="white" />}
                        <Text style={styles.intentText}>
                          {isFriend ? 'Looking for Friend' : 'Looking for Date'}
                        </Text>
                      </View>

                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName} numberOfLines={1}>{profile.name}, {profile.age}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <House size={12} color="white" opacity={0.8} />
                          <Text style={styles.cardLocation} numberOfLines={1}>{profile.location || 'Nearby'}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </AnimatedTouchable>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.brandText, { color: colors.text }]}>
          Likes & <Text style={{ color: colors.primary }}>Matches</Text>
        </Text>

        <TouchableOpacity
          onPress={() => setIsEditMode(!isEditMode)}
          style={[styles.editBtn, isEditMode && { backgroundColor: colors.primary + '20' }]}
        >
          <Pencil size={22} color={isEditMode ? colors.primary : colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.modeContainer}>
        <Animated.View
          style={[
            styles.animatedPill,
            { backgroundColor: colors.primary },
            {
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TAB_WIDTH]
                })
              }]
            }
          ]}
        />

        {(['Likes', 'Matches'] as const).map((m, index) => {
          const isActive = mainTab === m;
          const count = m === 'Likes' ? profiles.length : matches.length;

          return (
            <TouchableOpacity
              key={m}
              style={styles.modeBtn}
              onPress={() => switchTab(m, index)}
            >
              <View style={styles.modeBtnContent}>
                <Text style={[styles.modeText, { color: isActive ? 'white' : colors.text + '60' }]}>
                  {m}
                </Text>
                <View style={[styles.pillBadge, isActive ? styles.pillBadgeActive : styles.pillBadgeInactive]}>
                  <Text style={[styles.pillBadgeText, { color: isActive ? 'white' : colors.text + '90' }]}>{count}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {renderPage('Likes', profiles)}
        {renderPage('Matches', matches)}
      </ScrollView>

      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <UnifiedProfileView
            profile={selectedProfile}
            onClose={() => setIsModalVisible(false)}
            primaryColor={colors.primary}
          />

          {mainTab === 'Likes' && selectedProfile && (
            <View style={[styles.floatingPrompt, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.promptTextContainer}>
                <Text style={[styles.promptTitle, { color: colors.text }]}>Match with {selectedProfile.name}?</Text>
                <Text style={[styles.promptSubtitle, { color: colors.text }]}>They already liked you!</Text>
              </View>
              <View style={styles.promptActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }]} onPress={() => handleMatchAction('pass')}>
                  <X size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => handleMatchAction('like')}>
                  <Heart size={20} color="white" fill="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}


const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 10
  },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: -1.5 },
  editBtn: { padding: 10, borderRadius: 12 },

  modeContainer: {
    flexDirection: 'row',
    marginHorizontal: 25,
    backgroundColor: colors.card,
    padding: PILL_PADDING,
    borderRadius: 20,
    marginBottom: 15,
    position: 'relative'
  },
  animatedPill: {
    position: 'absolute',
    top: PILL_PADDING,
    bottom: PILL_PADDING,
    left: PILL_PADDING,
    width: TAB_WIDTH,
    borderRadius: 18,
  },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 18, zIndex: 1 },
  modeBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeText: { fontSize: 13, fontWeight: '700' },
  pillBadge: { height: 18, minWidth: 18, borderRadius: 9, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  pillBadgeActive: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  pillBadgeInactive: { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
  pillBadgeText: { fontSize: 10, fontWeight: '900' },

  gridContainer: { paddingHorizontal: 15, paddingBottom: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  card: { width: cardSize, height: cardSize * 1.4, borderRadius: 25, marginBottom: 15, overflow: 'hidden', borderWidth: 1 },
  cardImage: { width: '100%', height: '100%' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },

  removeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  removeCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowOpacity: 0.3, shadowRadius: 10 },

  cardInfo: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  cardName: { fontSize: 16, fontWeight: '900', color: 'white' },
  cardLocation: { fontSize: 11, color: 'white', opacity: 0.9 },

  intentTag: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  intentText: { color: 'white', fontSize: 10, fontWeight: '800' },

  emptyStateContainer: { marginTop: 100, alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.text, opacity: 0.5, textAlign: 'center', marginTop: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 15, fontWeight: '700', opacity: 0.4 },

  floatingPrompt: { position: 'absolute', bottom: 35, left: 20, right: 20, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 15, borderWidth: 1 },
  promptTextContainer: { flex: 1 },
  promptTitle: { fontSize: 16, fontWeight: '900' },
  promptSubtitle: { fontSize: 12, opacity: 0.5, fontWeight: '700', marginTop: 3 },
  promptActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
});