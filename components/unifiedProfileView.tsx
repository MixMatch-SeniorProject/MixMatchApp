import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  PanResponder,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  X, CheckCircle2, Briefcase, Play, Wine,
  Dumbbell, Pause, User, Church, School,
  Heart, Cigarette, Pill, Timer,
  Fingerprint, Flame, GraduationCap, MapPin,
  Sparkles, Music, Ruler, UserRoundPen, Users,
  Building, Languages,
} from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { playPreview, stopPreview, getStatus } from '@/services/audioService';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PILL_HEIGHT = 90;
const SNAP_BOTTOM = 0;
const SNAP_TOP = -(SCREEN_HEIGHT - 260);


const isValid = (val: any) => {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str !== "" && str !== "N/A" && str !== "Unknown" && str !== "Add" && str !== "0'0\"";
};

export default function UnifiedProfileView({ onClose, profile, primaryColor }: any) {
  const { colors, isDark } = useTheme();
  const pageAccent = primaryColor || colors.primary;

  const [showPill, setShowPill] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: SNAP_BOTTOM })).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const isHidden = (id: string) => profile?.hiddenFields?.includes(id);

  // Vinyl Rotation Animation
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotationLoop = useRef<Animated.CompositeAnimation | null>(null);

  const resolvedProfileImage = useMemo(() => {
    return profile?.mainMusicArt || profile?.mainMusicImage || profile?.image || profile?.photos?.[0];
  }, [profile]);

  useEffect(() => {
    if (isPlaying) {
      rotationLoop.current = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotationLoop.current.start();
    } else {
      rotationLoop.current?.stop();
    }
  }, [isPlaying]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    if (profile?.topSongs && profile.mainMusicTitle) {
      const idx = profile.topSongs.findIndex((s: any) => s.trackName === profile.mainMusicTitle);
      if (idx !== -1) setCurrentTrackIndex(idx);
    }
  }, [profile]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(async () => {
        const status = await getStatus();
        if (status) setProgress(status.position / status.duration);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Safely calculate height to avoid rendering weird defaults
  const displayHeight = profile?.heightFt
    ? `${profile.heightFt}'${profile.heightIn || 0}"`
    : (profile?.height || '');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderGrant: () => {
        pan.setOffset({ x: 0, y: (pan.y as any)._value });
      },
      onPanResponderMove: Animated.event([null, { dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        const currentY = (pan.y as any)._value;
        const targetValue = (currentY + gestureState.vy * 50) < (SNAP_TOP / 2) ? SNAP_TOP : SNAP_BOTTOM;

        Animated.spring(pan.y, {
          toValue: targetValue,
          friction: 6,
          tension: 40,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const handleTogglePlay = async (index?: number) => {
    const targetIdx = index !== undefined ? index : currentTrackIndex;
    const track = profile.topSongs?.[targetIdx];
    if (isPlaying && targetIdx === currentTrackIndex) {
      await stopPreview();
      setIsPlaying(false);
    } else {
      await stopPreview();
      const previewUrl = track?.previewUrl || profile.mainMusicPreview;
      if (previewUrl) {
        setCurrentTrackIndex(targetIdx);
        await playPreview(previewUrl);
        setIsPlaying(true);
        setShowPill(true);
      }
    }
  };

  const killPill = async () => {
    await stopPreview();
    setIsPlaying(false);
    setShowPill(false);
    pan.setValue({ x: 0, y: SNAP_BOTTOM });
  };

  const GridItem = ({ icon: Icon, text, label }: any) => {
    if (!isValid(text)) return null;
    return (
      <View style={styles.gridItem}>
        <Icon size={16} color={pageAccent} style={styles.gridIcon} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.gridLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.gridValue, { color: colors.text }]}>{text}</Text>
        </View>
      </View>
    );
  };


  const essentialItems = [
    !isHidden('height') && { icon: Ruler, text: displayHeight, label: "Height" },
    !isHidden('bodyType') && { icon: User, text: profile?.bodyType, label: "Body Type" },
    !isHidden('work') && { icon: Briefcase, text: profile?.jobTitle, label: "Work" },
    !isHidden('work') && { icon: Building, text: profile?.work, label: "Company" },
    !isHidden('education') && { icon: GraduationCap, text: profile?.education, label: "Education" },
    !isHidden('education') && { icon: School, text: profile?.school, label: "School" },
    { icon: MapPin, text: profile?.location, label: "Lives in" }, 
    { icon: Flame, text: profile?.datingIntentions, label: "Looking for" }, 
  ].filter(item => item && isValid(item.text));
  const identityItems = [
    !isHidden('sexuality') && { icon: Heart, text: profile?.sexuality, label: "Sexuality" },
    { icon: User, text: profile?.gender, label: "Gender" }, 
    !isHidden('pronouns') && { icon: UserRoundPen, text: profile?.pronouns, label: "Pronouns" },
    !isHidden('ethnicity') && { icon: Fingerprint, text: profile?.ethnicity, label: "Ethnicity" },
    !isHidden('religion') && { icon: Church, text: profile?.religion, label: "Religion" },
    { icon: Languages, text: Array.isArray(profile?.languages) ? profile.languages.join(', ') : profile?.languages, label: "Languages" }, 
  ].filter(item => item && isValid(item.text));

  const lifestyleItems = [
    !isHidden('drinking') && { icon: Wine, text: profile?.drinking, label: "Drinking" },
    !isHidden('smoking') && { icon: Cigarette, text: profile?.smoking, label: "Smoking" },
    !isHidden('drugs') && { icon: Pill, text: profile?.drugs, label: "Drugs" },
    !isHidden('workout') && { icon: Dumbbell, text: profile?.workout, label: "Exercise" },
    !isHidden('activeTime') && { icon: Timer, text: profile?.activeTime, label: "Active" },
  ].filter(item => item && isValid(item.text));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* HEADER BANNER */}
        <View style={styles.bannerContainer}>
          <Image source={{ uri: resolvedProfileImage }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={10} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: isDark ? 0.7 : 0.4 }]} />

          <TouchableOpacity style={styles.closeBtnHeader} onPress={onClose}>
            <View style={styles.closeIconCircle}><X size={22} color="#FFF" /></View>
          </TouchableOpacity>

          <View style={styles.heroRowHeader}>
            <Image source={{ uri: resolvedProfileImage }} style={styles.profilePhotoSmall} />
            <View style={styles.heroNameCol}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, styles.headerText]}>{profile?.name}, {profile?.age}</Text>
                {profile?.verified && <CheckCircle2 size={22} color={pageAccent} />}
              </View>
              {isValid(profile?.location) && (
                <Text style={[styles.locationText, styles.headerText, { opacity: 0.9 }]}>{profile.location}</Text>
              )}

              <View style={styles.headerIntentTag}>
                {/* Check the contextual stamp first, fallback to DB array */}
                {profile?.connectionMode === 'Friend' || (profile?.mode?.includes('Friends') && !profile?.mode?.includes('Dating')) ? (
                  <>
                    <Users size={12} color="#FFF" />
                    <Text style={styles.headerIntentText}>Looking for Friend</Text>
                  </>
                ) : (
                  <>
                    <Heart size={12} color="#FFF" />
                    <Text style={styles.headerIntentText}>Looking for Date</Text>
                  </>
                )}
              </View>

            </View>
          </View>
        </View>

        <View style={styles.body}>

          {/* 1. ANTHEM CARD WITH VINYL ROTATION */}
          {isValid(profile?.mainMusicTitle) && (
            <TouchableOpacity
              style={[styles.anthemCard, { backgroundColor: pageAccent }]}
              onPress={() => handleTogglePlay()}
            >
              <View style={styles.anthemInfo}>
                <Music size={16} color="#FFF" style={{ marginBottom: 4 }} />
                <Text style={styles.anthemLabel}>MY ANTHEM</Text>
                <Text style={styles.anthemTitle} numberOfLines={1}>{profile.mainMusicTitle}</Text>
                <Text style={styles.anthemArtist} numberOfLines={1}>{profile.mainMusicArtist}</Text>
              </View>

              <Animated.Image
                source={{ uri: profile.mainMusicArt || profile.mainMusicImage }}
                style={[styles.anthemArt, { transform: [{ rotate: spin }] }]}
              />

              <View style={styles.anthemPlayCircle}>
                {isPlaying ? <Pause size={20} color={pageAccent} fill={pageAccent} /> : <Play size={20} color={pageAccent} fill={pageAccent} style={{ marginLeft: 2 }} />}
              </View>
            </TouchableOpacity>
          )}

          {/* 2. MUSICAL DNA */}
          {profile?.topSongs && profile.topSongs.length > 0 && (
            <View style={{ marginBottom: 25 }}>
              <Text style={[styles.groupHeading, { color: colors.text, marginBottom: 15 }]}>Musical DNA</Text>
              <FlatList
                horizontal
                data={profile.topSongs}
                keyExtractor={(_, i) => i.toString()}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 10 }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.dnaCard, { backgroundColor: colors.card }]}
                    onPress={() => handleTogglePlay(index)}
                  >
                    <Image source={{ uri: item.artworkUrl100?.replace('100x100bb', '400x400bb') }} style={styles.dnaImage} />
                    <Text style={[styles.dnaName, { color: colors.text }]} numberOfLines={1}>{item.trackName}</Text>
                    <Text style={[styles.dnaArtist, { color: colors.text }]} numberOfLines={1}>{item.artistName}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* 3. BIO SECTION */}
          {isValid(profile?.personality) || isValid(profile?.bio) ? (
            <View style={{ marginBottom: 25 }}>
              <Text style={[styles.groupHeading, { color: colors.text }]}>About Me</Text>
              <View style={[styles.mainCard, { backgroundColor: colors.card, marginTop: 4 }]}>
                <Sparkles size={20} color={pageAccent} style={{ marginBottom: 10 }} />
                <Text style={[styles.bioText, { color: colors.text }]}>{profile.personality || profile.bio}</Text>
              </View>
            </View>
          ) : null}

          {/* ESSENTIALS GRID */}
          {essentialItems.length > 0 && (
            <View style={{ marginBottom: 25 }}>
              <Text style={[styles.groupHeading, { color: colors.text }]}>The Essentials</Text>
              <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
                {essentialItems.map((item, idx) => (
                  <GridItem key={`ess-${idx}`} icon={item.icon} text={item.text} label={item.label} />
                ))}
              </View>
            </View>
          )}

          {/* IDENTITY GRID */}
          {identityItems.length > 0 && (
            <View style={{ marginBottom: 25 }}>
              <Text style={[styles.groupHeading, { color: colors.text }]}>Identity</Text>
              <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
                {identityItems.map((item, idx) => (
                  <GridItem key={`id-${idx}`} icon={item.icon} text={item.text} label={item.label} />
                ))}
              </View>
            </View>
          )}

          {/* LIFESTYLE GRID */}
          {lifestyleItems.length > 0 && (
            <View style={{ marginBottom: 25 }}>
              <Text style={[styles.groupHeading, { color: colors.text }]}>Lifestyle</Text>
              <View style={[styles.gridCard, { backgroundColor: colors.card }]}>
                {lifestyleItems.map((item, idx) => (
                  <GridItem key={`life-${idx}`} icon={item.icon} text={item.text} label={item.label} />
                ))}
              </View>
            </View>
          )}

          {/* HOBBIES */}
          {isValid(profile?.hobbies) && (
            <View style={{ marginBottom: 25 }}>
              <Text style={[styles.groupHeading, { color: colors.text }]}>Hobbies & Interests</Text>
              <View style={[styles.mainCard, { backgroundColor: colors.card, marginTop: 4 }]}>
                <Text style={[styles.bioText, { color: colors.text, opacity: 0.8 }]}>{profile.hobbies}</Text>
              </View>
            </View>
          )}

        </View>
      </Animated.ScrollView>

      {/* PILL PLAYER */}
      {showPill && (
        <Animated.View {...panResponder.panHandlers} style={[styles.pillWrapper, { transform: [{ translateY: pan.y }] }]}>
          <View style={[styles.pillContainer, { backgroundColor: colors.card, borderColor: colors.card + '20' }]}>
            <View style={styles.pillProgressBg}><Animated.View style={[styles.pillProgressBar, { width: `${progress * 100}%`, backgroundColor: pageAccent }]} /></View>
            <View style={styles.pillContent}>
              <Image source={{ uri: profile.topSongs?.[currentTrackIndex]?.artworkUrl100 || profile.mainMusicArt }} style={styles.pillArt} />
              <View style={styles.pillInfo}>
                <Text style={[styles.pillTitle, { color: colors.text }]} numberOfLines={1}>{profile.topSongs?.[currentTrackIndex]?.trackName || profile.mainMusicTitle}</Text>
                <Text style={[styles.pillArtist, { color: colors.text, opacity: 0.6 }]} numberOfLines={1}>{profile.topSongs?.[currentTrackIndex]?.artistName || profile.mainMusicArtist}</Text>
              </View>
              <View style={styles.pillControls}>
                <TouchableOpacity onPress={() => handleTogglePlay()}>
                  <View style={[styles.pillPlayBtn, { backgroundColor: pageAccent }]}>
                    {isPlaying ? <Pause size={20} color="#FFF" fill="#FFF" /> : <Play size={20} color="#FFF" fill="#FFF" style={{ marginLeft: 2 }} />}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={killPill} style={styles.pillKill}><X size={20} color={colors.text} opacity={0.4} /></TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bannerContainer: {
    paddingBottom: 40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#000'
  },
  headerText: { color: '#FFF', textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  closeBtnHeader: { position: 'absolute', top: 20, right: 20, zIndex: 20 },
  closeIconCircle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  scrollContent: { paddingBottom: 140 },
  heroRowHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, marginTop: 40, gap: 18 },
  profilePhotoSmall: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  heroNameCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  locationText: { fontSize: 15, fontWeight: '600' },
  body: { paddingHorizontal: 16, marginTop: 20 },
  mainCard: { padding: 22, borderRadius: 30 },
  bioText: { fontSize: 17, lineHeight: 26, fontWeight: '500' },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10, opacity: 0.5 },
  anthemCard: { height: 120, borderRadius: 30, marginBottom: 25, flexDirection: 'row', alignItems: 'center', padding: 20, overflow: 'hidden' },
  anthemInfo: { flex: 1, zIndex: 2 },
  anthemLabel: { fontSize: 10, fontWeight: '900', color: '#FFF', opacity: 0.7, letterSpacing: 1 },
  anthemTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  anthemArtist: { fontSize: 14, fontWeight: '600', color: '#FFF', opacity: 0.9 },
  anthemArt: {
    width: 140,
    height: 140,
    borderRadius: 70,
    position: 'absolute',
    right: -30,
    opacity: 0.4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  anthemPlayCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', position: 'absolute', right: 20 },
  groupHeading: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 10, marginBottom: 12, opacity: 0.5 },
  gridCard: { padding: 10, borderRadius: 30, flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    gap: 12
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '700',
    flexWrap: 'wrap',
  },
  gridIcon: { opacity: 0.8 },
  gridLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 },
  dnaCard: { width: 110, padding: 8, borderRadius: 20 },
  dnaImage: { width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 8 },
  dnaName: { fontSize: 12, fontWeight: '800' },
  dnaArtist: { fontSize: 10, opacity: 0.5, fontWeight: '600' },
  pillWrapper: { position: 'absolute', bottom: 40, left: 0, right: 0, zIndex: 9999, alignItems: 'center' },
  pillContainer: { width: width * 0.92, height: PILL_HEIGHT, borderRadius: PILL_HEIGHT / 2, borderWidth: 1, elevation: 10, shadowOpacity: 0.2, overflow: 'hidden' },
  pillProgressBg: { height: 3, width: '100%', backgroundColor: 'rgba(0,0,0,0.05)' },
  pillProgressBar: { height: '100%' },
  pillContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  pillArt: { width: 60, height: 60, borderRadius: 30 },
  pillInfo: { flex: 1, marginLeft: 12 },
  pillTitle: { fontSize: 14, fontWeight: 'bold' },
  pillArtist: { fontSize: 12 },
  pillControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillPlayBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  pillKill: { padding: 5 },
  headerIntentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  headerIntentText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800'
  }
});