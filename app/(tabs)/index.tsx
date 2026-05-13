import { userService } from '@/services/userService';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet, View, Text, Animated as RNAnimated, TouchableOpacity,
  Dimensions, PanResponder, ActivityIndicator, ScrollView, Modal, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart, HeartOff, CheckCircle2, Sparkles,
  Music, Music2, RotateCcw, MapPin, X, Activity, Trash2, ShieldAlert, Info, Users
} from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import UnifiedProfileView from '@/components/unifiedProfileView';
import { useAuth } from '@/auth/AuthContext';
import { matchService } from '@/services/matchService';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.4;
const sanitizeToCompleteSentence = (text: string, maxChars = 130) => {
  if (!text) return '';
  if (text.length <= maxChars) return text;

  
  const sliced = text.substring(0, maxChars);


  const match = sliced.match(/.*[.!?]/);

  if (match) {
    
    return match[0];
  }

  
  return sliced.trim() + '...';
};

export default function SwipeScreen() {

  const { user, profile, refreshProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [rawPool, setRawPool] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [hasMixed, setHasMixed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<'Date' | 'All' | 'Friend'>('All');
  const [profileVisible, setProfileVisible] = useState(false);

  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

  const [mixingRoomVisible, setMixingRoomVisible] = useState(false);
  const [activityLog, setActivityLog] = useState<{ msg: string, detail?: string, type: 'info' | 'fail' | 'success' }[]>([]);

  const currentUser = profiles[currentIndex];
  const outOfProfiles = hasMixed && currentIndex >= profiles.length && rawPool.length === 0 && !loading && !isScoring;
  const isBuffering = hasMixed && currentIndex >= profiles.length && (rawPool.length > 0 || isScoring);

  const pan = useRef(new RNAnimated.ValueXY()).current;
  const slideUpAnim = useRef(new RNAnimated.Value(50)).current;
  const isSwiping = useRef(false);
  const discoverySession = useRef(0);
  const isScoringRef = useRef(false);
  const hasResetOnLaunch = useRef(false);

  const addLog = (msg: string, detail?: string, type: 'info' | 'fail' | 'success' = 'info') => {
    setActivityLog(prev => [{ msg, detail, type }, ...prev].slice(0, 60));
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 10;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsScrolledToBottom(isBottom);
  };

 //set all
  useEffect(() => {
    if (user && !hasResetOnLaunch.current) {
      hasResetOnLaunch.current = true;

      const resetToAll = async () => {
        try {
          await userService.updateUserProfile(user.uid, { mode: ['Dating', 'Friends'] });
          await refreshProfile();
          setMode('All');
          addLog('🚀 System Online', 'Intentions reset to ALL for the new session.', 'info');
        } catch (error) {
          console.error("Launch reset failed", error);
        }
      };

      resetToAll();
    }
  }, [user]);

  // hot swap with cooldown
  const handleModeSwitch = async (m: 'Date' | 'All' | 'Friend') => {
    if (m === mode) return;

    if (isSwitchingMode) {
      Alert.alert("Calibrating...", "Please wait a few seconds for your network preferences to update.");
      return;
    }

    setIsSwitchingMode(true);

    let dbMode: string[] = [];
    if (m === 'Date') dbMode = ['Dating'];
    if (m === 'Friend') dbMode = ['Friends'];
    if (m === 'All') dbMode = ['Dating', 'Friends'];

    addLog(`⚙️ Recalibrating`, `Updating your broadcast signal to: ${m}`, 'info');

    try {
      if (user) {
        await userService.updateUserProfile(user.uid, { mode: dbMode });
        await refreshProfile();
      }

      setMode(m);

      setTimeout(() => {
        setIsSwitchingMode(false);
      }, 5000);

    } catch (error) {
      addLog(`❌ Signal Error`, `Failed to sync preferences`, 'fail');
      setIsSwitchingMode(false);
    }
  };


  const startDiscovery = async () => {
    if (!user || !profile) return;

    discoverySession.current += 1;
    setLoading(true);
    setHasMixed(true);
    setProfiles([]);
    setCurrentIndex(0);
    setRawPool([]);

    addLog(`🔄 Scanning Network`, `Looking for ${mode} connections nearby`, 'info');

    try {
      const candidates = await matchService.getEligibleProfiles(profile, mode);
      addLog(`📡 Signal Acquired`, `Found ${candidates.length} potential matches. Queuing AI analysis...`, 'info');

      if (candidates.length > 0) {
        setRawPool(candidates);
      }
    } catch (error: any) {
      addLog(`🔥 Network Interruption`, error.message, 'fail');
    } finally {
      setLoading(false);
    }
  };

  // --- SECOND CHANCE SHUFFLE ---
  const handleSecondChance = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await matchService.undoPasses(user.uid);
      if (res.count === 0) {
        Alert.alert("No Profiles Found", "You haven't passed on anyone yet!");
        setLoading(false);
        return;
      }
      addLog(`🔀 Second Chance Shuffle`, `Restored ${res.count} previously passed profiles.`, 'success');
      await startDiscovery();
    } catch (error) {
      addLog(`❌ Shuffle Failed`, `Could not restore profiles.`, 'fail');
      setLoading(false);
    }
  };

  const processNextCandidate = async () => {
    if (isScoringRef.current || rawPool.length === 0) return;

    isScoringRef.current = true;
    setIsScoring(true);

    const nextCandidate = rawPool[0];
    setRawPool(prev => prev.slice(1));

    const currentSession = discoverySession.current;

    try {
      const cacheKey = `ai_score_${profile.uid}_${nextCandidate.id}_${mode}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      let res;

      if (cachedData) {
        res = JSON.parse(cachedData);
        addLog(`⚡ Cache Hit`, `Loaded previously analyzed DNA for ${nextCandidate.name}`, 'info');
      } else {
        addLog(`🧠 Analyzing DNA`, `Comparing your taste with ${nextCandidate.name}...`, 'info');
        res = await matchService.getAiCompatibility(profile, nextCandidate, mode);

        if (currentSession !== discoverySession.current) {
          isScoringRef.current = false;
          setIsScoring(false);
          return;
        }

        await AsyncStorage.setItem(cacheKey, JSON.stringify(res));
      }

      if (res.failReason) {
        addLog(`Skipped: ${nextCandidate.name}`, `${res.failReason}: ${res.detail}`, "fail");
      } else {
        if (nextCandidate.hasLikedMe) {
          addLog(`🔥 Mutual Vibe Detected`, `${nextCandidate.name} is already interested!`, "success");
        }
        addLog(`✨ Match Curated`, `${nextCandidate.name} scored ${res.score}% compatibility`, "success");

        const scoredUser = {
          ...nextCandidate,
          aiScore: res.score,
          aiReason: res.reason,
          aiTags: res.tags,
          aiThinking: res.thinking
        };

        setProfiles(prev => {
          const newProfiles = [...prev, scoredUser];
          if (newProfiles.length - currentIndex === 1) {
            setTimeout(triggerSlideUp, 50);
          }
          return newProfiles;
        });
      }
    } catch (error: any) {
      if (currentSession !== discoverySession.current) {
        isScoringRef.current = false;
        setIsScoring(false);
        return;
      }
      addLog(`❌ AI Interruption`, `Skipped ${nextCandidate.name} due to poor connection`, 'fail');
    } finally {
      isScoringRef.current = false;
      setIsScoring(false);
    }
  };

  useEffect(() => {
    if (hasMixed && rawPool.length > 0 && !isScoring) {
      const cardsRemaining = profiles.length - currentIndex;
      if (cardsRemaining < 3) {
        processNextCandidate();
      }
    }
  }, [hasMixed, rawPool.length, isScoring, profiles.length, currentIndex]);

  useEffect(() => {
    if (hasMixed) {
      startDiscovery();
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      if (hasMixed && profiles.length === 0) {
        startDiscovery();
      }
    }, [hasMixed, mode])
  );

  const triggerSlideUp = () => {
    slideUpAnim.setValue(50);
    RNAnimated.spring(slideUpAnim, { toValue: 0, friction: 8, useNativeDriver: false }).start();
  };

  const nextCard = () => {
    pan.setValue({ x: 0, y: 0 });
    setCurrentIndex(prev => prev + 1);
    setIsScrolledToBottom(false); // Reset scroll state for the next card
    triggerSlideUp();
    isSwiping.current = false;
  };

  const handleSwipe = async (type: 'like' | 'pass') => {
    if (!currentUser || !user || isSwiping.current) return;
    isSwiping.current = true;

    const actionText = type === 'like' ? 'Vibing with' : 'Passed on';
    addLog(`Recorded Interaction`, `${actionText} ${currentUser.name}`, 'info');

    try {
      let interactionMode = mode;

      if (mode === 'All') {
        const mutualDating = user.mode?.includes('Dating') && currentUser.mode?.includes('Dating');
        interactionMode = mutualDating ? 'Date' : 'Friend';
      }

      const result = await matchService.recordInteraction(user.uid, currentUser.id, type, interactionMode);

      if (result.match) {
        addLog(`🎉 IT'S A MATCH`, `You and ${currentUser.name} connected!`, 'success');
        Alert.alert("It's a Match! 🎉", `You and ${currentUser.name} liked each other!`);
      }
    } catch (error: any) {
      addLog(`Sync Error`, `Failed to record choice securely`, 'fail');
    }

    RNAnimated.timing(pan, {
      toValue: { x: type === 'like' ? width * 1.5 : -width * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: false
    }).start(nextCard);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => { pan.x.setValue(gesture.dx); },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) handleSwipe('like');
        else if (gesture.dx < -SWIPE_THRESHOLD) handleSwipe('pass');
        else {
          RNAnimated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 4, useNativeDriver: false }).start();
        }
      }
    })
  ).current;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.container} edges={['top']}>

        <View style={styles.header}>
          <Text style={[styles.brandText, { color: colors.text }]}>
            Mix<Text style={{ color: colors.primary }}>Match</Text>
          </Text>
          <TouchableOpacity onPress={() => setMixingRoomVisible(true)} style={styles.headerIconBtn}>
            <Activity size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modeContainer}>
          {(['Date', 'All', 'Friend'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && { backgroundColor: colors.primary }]}
              onPress={() => handleModeSwitch(m)}
              activeOpacity={isSwitchingMode ? 1 : 0.7}
            >
              <Text style={[styles.modeText, { color: mode === m ? 'white' : colors.text + '60' }]}>
                {m}
              </Text>
            </TouchableOpacity>
          ))}
          {isSwitchingMode && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ position: 'absolute', right: 15, top: 8 }}
            />
          )}
        </View>

        {!hasMixed ? (
          <View style={styles.center}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Music size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Start Mix-Matching!</Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={startDiscovery}
            >
              <Text style={styles.primaryBtnText}>Begin Discovery</Text>
            </TouchableOpacity>

            <Text style={[styles.disclaimerText, { color: colors.text }]}>
              By proceeding, you acknowledge and agree that your personal data and musical preferences will be processed using Google’s Gemini AI cloud infrastructure. This processing is conducted for the sole purpose of generating tailored recommendations and enhancing user matching.
            </Text>
          </View>

        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Connecting to Gemini...</Text>
          </View>

        ) : isBuffering ? (
          <View style={styles.center}>

            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 15 }} />

            <Text style={[styles.title, { color: colors.text, marginBottom: 30 }]}>Mix-Matching...</Text>


            <View style={[styles.terminalBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.terminalHeaderRow}>
                <View style={[styles.terminalDot, { backgroundColor: '#FF5F56' }]} />
                <View style={[styles.terminalDot, { backgroundColor: '#FFBD2E' }]} />
                <View style={[styles.terminalDot, { backgroundColor: '#27C93F' }]} />
                <Text style={[styles.terminalHeader, { color: colors.text }]}>system.ai_analysis_active</Text>
              </View>

              {activityLog.slice(0, 4).map((log, idx) => (
                <View key={idx} style={[styles.terminalRow, { opacity: 1 - (idx * 0.25) }]}>
                  <Text style={{ color: log.type === 'fail' ? '#FF3B30' : colors.primary, marginRight: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                    {log.type === 'fail' ? '!' : '>'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.terminalText, { color: colors.text }]}>{log.msg}</Text>
                    {log.detail && (
                      <Text style={[styles.terminalSubtext, { color: colors.text + '80' }]}>{log.detail}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

        ) : outOfProfiles ? (
          <View style={styles.center}>
            <RotateCcw size={48} color={colors.text} opacity={0.2} />
            <Text style={[styles.title, { color: colors.text, marginTop: 20 }]}>Deck Empty</Text>

            <TouchableOpacity onPress={startDiscovery} style={{ marginTop: 20 }}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>RESCAN DATABASE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSecondChance}
              style={{
                marginTop: 30,
                paddingVertical: 14,
                paddingHorizontal: 24,
                backgroundColor: colors.primary + '15',
                borderRadius: 20
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '800' }}>SECOND CHANCE SHUFFLE</Text>
            </TouchableOpacity>
          </View>

        ) : currentUser ? (
          <RNAnimated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                transform: [{ translateX: pan.x }, { translateY: slideUpAnim }],
                backgroundColor: colors.card,
                borderColor: colors.cardBorder
              }
            ]}
          >
            <TouchableOpacity activeOpacity={0.9} onPress={() => setProfileVisible(true)} style={{ flex: 1 }}>

             
              <View style={styles.imageContainer}>
                <Image
                  source={{
                    uri: currentUser?.mainMusicArt ||
                      currentUser?.mainMusicImage ||
                      currentUser?.image ||
                      currentUser?.photos?.[0]
                  }}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={200}
                />

                {/* Contextual Intent Tag Overlay */}
                <View style={styles.intentTag}>
                  {(() => {
                    let displayMode = mode;
                    if (mode === 'All') {
                      const mutualDating = user?.mode?.includes('Dating') && currentUser?.mode?.includes('Dating');
                      displayMode = mutualDating ? 'Date' : 'Friend';
                    }
                    return displayMode === 'Friend' ? (
                      <>
                        <Users size={12} color="white" />
                        <Text style={styles.intentText}>Looking for Friend</Text>
                      </>
                    ) : (
                      <>
                        <Heart size={12} color="white" />
                        <Text style={styles.intentText}>Looking for Date</Text>
                      </>
                    );
                  })()}
                </View>

                <View style={styles.anthemOverlay}>
                  <Music2 size={14} color="white" />
                  <Text style={styles.anthemText} numberOfLines={1}>{currentUser?.mainMusicTitle}</Text>
                </View>
                {currentUser?.hasLikedMe && (
                  <View style={[styles.likedMePill, { backgroundColor: colors.primary }]}>
                    <Heart size={12} color="white" fill="white" />
                    <Text style={styles.likedMeText}>LIKES YOU</Text>
                  </View>
                )}
              </View>

                  
                      <View style={{ flex: 1, position: 'relative' }}>
                        <ScrollView
                          style={{ flex: 1 }}
                          contentContainerStyle={styles.infoContainer}
                          showsVerticalScrollIndicator={false}
                          onScroll={handleScroll}
                          scrollEventThrottle={16}
                        >
                          <View style={styles.nameRow}>
                            <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
                              {currentUser?.name}, {currentUser?.age}
                            </Text>

                            {(currentUser?.gender || currentUser?.sexuality) ? (
                              <View style={{ flexDirection: 'row', gap: 6, flexShrink: 0 }}>
                                {currentUser?.gender && (
                                  <View style={[styles.identityPill, { borderColor: colors.text + '40' }]}>
                                    <Text style={[styles.identityText, { color: colors.text + '90' }]}>
                                      {currentUser.gender}
                                    </Text>
                                  </View>
                                )}
                                {currentUser?.sexuality && (
                                  <View style={[styles.identityPill, { borderColor: colors.text + '40' }]}>
                                    <Text style={[styles.identityText, { color: colors.text + '90' }]}>
                                      {currentUser.sexuality}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.locationRow}>
                            <MapPin size={14} color={colors.subtext || (colors.text + '80')} />
                            <Text style={[styles.locationText, { color: colors.subtext || (colors.text + '80') }]}>
                              {!currentUser?.hiddenFields?.includes('distance') && currentUser?.distanceAway
                                ? `${currentUser.distanceAway} miles away • `
                                : ''}
                              {currentUser?.location}
                            </Text>
                          </View>

                          {/* AI Music Match Info */}
                          <View style={styles.aiMatchSection}>
                            <View style={styles.aiScoreRow}>
                              <Sparkles size={16} color={colors.primary} />
                              <Text style={[styles.aiScoreText, { color: colors.primary }]}>
                                {currentUser?.aiScore}% Music Match
                              </Text>
                            </View>

                            {/* Sanitized AI Reason */}
                            <Text style={[styles.aiReasonText, { color: colors.text }]} numberOfLines={3}>
                              "{sanitizeToCompleteSentence(currentUser?.aiReason)}"
                            </Text>

                            {/* Pill Tags Container */}
                            {currentUser?.aiTags && currentUser.aiTags.length > 0 && (
                              <View style={styles.tagsContainer}>
                                {currentUser.aiTags.map((tag: any, idx: number) => {
                                  const isExact = tag.matchLevel === 'exact';
                                  const isClose = tag.matchLevel === 'close';
                                  const tagColor = isExact || isClose ? colors.primary : (colors.text + '50');

                                  return (
                                    <View
                                      key={idx}
                                      style={[
                                        styles.tagPill,
                                        { borderColor: tagColor },
                                        isExact && {
                                          backgroundColor: tagColor,
                                          borderColor: tagColor,
                                        }
                                      ]}
                                    >
                                      <Text style={[
                                        styles.tagText,
                                        { color: isExact ? colors.background : (isClose ? tagColor : colors.text + '80') }
                                      ]}>
                                        {tag.text}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        </ScrollView>

                        {!isScrolledToBottom && (
                          <LinearGradient
                            colors={['transparent', colors.card]}
                            style={styles.fadeOverlay}
                            pointerEvents="none"
                          />
                        )}
                      </View>
            </TouchableOpacity>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.circleBtn, { borderColor: colors.cardBorder }]} onPress={() => handleSwipe('pass')}>
                <HeartOff size={28} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.circleBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleSwipe('like')}
              >
                <Heart size={28} color={colors.background} fill={colors.background} />
              </TouchableOpacity>
            </View>
          </RNAnimated.View>
        ) : null}

        {/* LOG MODAL */}
        <Modal
          visible={mixingRoomVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setMixingRoomVisible(false)}
        >
          <SafeAreaView style={[styles.logContainer, { backgroundColor: colors.background }]}>
            <View style={styles.logHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.pulseIconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Activity size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.logHeaderTitle, { color: colors.text }]}>Live Mixing Feed</Text>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>ALGORITHM ACTIVE</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={() => setActivityLog([])} style={{ padding: 5 }}>
                  <Trash2 size={20} color={colors.text} opacity={0.4} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMixingRoomVisible(false)} style={{ padding: 5 }}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 10 }}>
              {activityLog.length === 0 ? (
                <View style={styles.emptyLogContainer}>
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 15 }} />
                  <Text style={{ color: colors.text, opacity: 0.4, textAlign: 'center', fontWeight: '500' }}>
                    Warming up the algorithm...
                  </Text>
                </View>
              ) : (
                activityLog.map((log, i) => (
                  <View key={i} style={styles.logLine}>
                    <View style={styles.logIcon}>
                      {log.type === 'fail' ? <ShieldAlert size={16} color="#FF3B30" /> :
                        log.type === 'success' ? <CheckCircle2 size={16} color={colors.primary} /> :
                          <Info size={16} color={colors.text} opacity={0.3} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.logMsg, { color: log.type === 'fail' ? '#FF3B30' : log.type === 'success' ? colors.primary : colors.text }]}>
                        {log.msg}
                      </Text>
                      {log.detail && (
                        <Text style={[styles.logDetail, { color: colors.text + '60' }]}>
                          {log.detail}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal visible={profileVisible} animationType="slide" presentationStyle="pageSheet">
          <UnifiedProfileView
            profile={{
              ...currentUser,
              connectionMode: (() => {
                if (mode === 'All') {
                  const mutualDating = user?.mode?.includes('Dating') && currentUser?.mode?.includes('Dating');
                  return mutualDating ? 'Date' : 'Friend';
                }
                return mode;
              })()
            }}
            onClose={() => setProfileVisible(false)}
            primaryColor={colors.primary}
          />
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 10
  },
  brandText: { fontSize: 26, fontWeight: '900', letterSpacing: -1.5 },
  headerIconBtn: { padding: 10, borderRadius: 12, backgroundColor: colors.primary + '10' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  primaryBtn: { marginTop: 30, paddingHorizontal: 40, paddingVertical: 18, borderRadius: 30 },
  primaryBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  loadingText: { marginTop: 15, fontWeight: '700', opacity: 0.4 },

  disclaimerText: {
    marginTop: 20,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.5,
    lineHeight: 18,
    paddingHorizontal: 20,
    fontWeight: '500'
  },

  modeContainer: {
    flexDirection: 'row',
    marginHorizontal: 25,
    backgroundColor: colors.card,
    padding: 4,
    borderRadius: 20,
    marginBottom: 15
  },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 18 },
  modeText: { fontSize: 13, fontWeight: '700' },

  card: {
    flex: 1,
    marginHorizontal: 15,
    marginBottom: 20,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderBottomWidth: 11,
    backgroundColor: colors.card
  },

  imageContainer: {
    height: '45%',
    width: '100%',
    backgroundColor: isDark ? '#222' : '#EEE'
  },
  cardImage: { width: '100%', height: '100%' },
  intentTag: {
    position: 'absolute', top: 15, left: 15,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  intentText: { color: 'white', fontSize: 11, fontWeight: '800' },

  anthemOverlay: {
    position: 'absolute', bottom: 15, left: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8
  },
  anthemText: { color: 'white', fontSize: 13, fontWeight: '800', maxWidth: 200 },

  likedMePill: {
    position: 'absolute', top: 15, right: 15,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  likedMeText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  infoContainer: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 15,
    paddingBottom: 60,
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', 
    gap: 10
  },
  nameText: { fontSize: 26, fontWeight: '900', flexShrink: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 15 },
  locationText: { fontWeight: '600', fontSize: 14 },

  aiMatchSection: {
    marginBottom: 15,
  },
  aiScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  aiScoreText: { fontSize: 14, fontWeight: '900' },
  aiReasonText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    fontStyle: 'italic',
    opacity: 0.9,
    marginBottom: 12
  },

  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10, 
  },
  tagPill: {
    flexGrow: 1,           
    maxWidth: '48%',       
    alignItems: 'center',  
    paddingHorizontal: 16, 
    paddingVertical: 8,    
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  tagText: {
    fontSize: 13,         
    fontWeight: '700',
    textTransform: 'capitalize',
    textAlign: 'center',   
  },

  bioText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    opacity: 0.8,
    marginTop: 10
  },

  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 20, backgroundColor: colors.card },
  circleBtn: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 0
  },

  logContainer: { flex: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  pulseIconContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  logHeaderTitle: { fontSize: 18, fontWeight: '900' },
  emptyLogContainer: { marginTop: 60, alignItems: 'center', justifyContent: 'center' },
  logLine: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 25 },
  logIcon: { width: 26, marginTop: 2 },
  logMsg: { fontSize: 14, fontWeight: '800' },
  logDetail: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  identityTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  identityPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    justifyContent: 'center'
  },
  identityText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  terminalBox: {
    width: '100%',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  terminalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  terminalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  terminalHeader: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 'auto',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.5,
  },
  terminalRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  terminalText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalSubtext: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});