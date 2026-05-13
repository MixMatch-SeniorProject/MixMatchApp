import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions, Image } from 'react-native';
import { 
  X, CheckCircle2, MapPin, Music, Mars, Venus, VenusAndMars, 
  Briefcase, GraduationCap, Ruler, Heart, Star, Sparkles, Globe 
} from 'lucide-react-native';
import { buildProfileTheme, useTheme, ProfileTheme } from '@/constants/themeHelper';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface DetailedProfileProps {
  isVisible: boolean;
  onClose: () => void;
  user: any; 
  passedColor?: string;
}

export default function DetailedProfile({ isVisible, onClose, user, passedColor }: DetailedProfileProps) {
  const { colors } = useTheme();
  
  const dominantColor = passedColor || '#B1A1D1';
  const profileTheme = useMemo(() => buildProfileTheme(dominantColor), [dominantColor]);
  const styles = useMemo(() => createStyles(colors, profileTheme, dominantColor), [colors, profileTheme, dominantColor]);

  if (!user) return null;

  const GenderIcon = () => {
    const g = user.gender?.toLowerCase();
    if (g === 'male') return <Mars size={18} color="#FFF" />;
    if (g === 'female') return <Venus size={18} color="#FFF" />;
    return <VenusAndMars size={18} color="#FFF" />;
  };

  const InfoSection = ({ title, content, icon: Icon }: any) => {
    if (!content || content.trim() === "") return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          {Icon && <Icon size={16} color="#FFF" style={{opacity: 0.6}} />}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionBody}>{content}</Text>
      </View>
    );
  };

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>

        <View style={StyleSheet.absoluteFill}>
          <Image 
            source={{ uri: user.image || user.photos?.[0] }} 
            style={StyleSheet.absoluteFill} 
            blurRadius={50} 
          />
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dominantColor, opacity: 0.2 }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile DNA</Text>
          <View style={{ width: 28 }} /> 
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Main Hero Image */}
          <Image source={{ uri: user.image || user.photos?.[0] }} style={styles.heroImage} />

          <View style={styles.mainContent}>
            {/* Identity */}
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.name}, {user.age}</Text>
              {user.verified && <CheckCircle2 size={24} color="#FFF" />}
            </View>
            
            <View style={styles.locationRow}>
              <MapPin size={16} color="#FFF" opacity={0.7} />
              <Text style={styles.locationText}>{user.location || 'Nearby'}</Text>
            </View>

            {/* Vitals Grid */}
            <View style={styles.vitalsGrid}>
              {user.gender && (
                <View style={styles.pill}><GenderIcon /><Text style={styles.pillText}>{user.gender}</Text></View>
              )}
              {user.height && (
                <View style={styles.pill}><Ruler size={18} color="#FFF" /><Text style={styles.pillText}>{user.height}</Text></View>
              )}
              {user.work && (
                <View style={styles.pill}><Briefcase size={18} color="#FFF" /><Text style={styles.pillText}>{user.work}</Text></View>
              )}
              {user.education && (
                <View style={styles.pill}><GraduationCap size={18} color="#FFF" /><Text style={styles.pillText}>{user.education}</Text></View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Content Sections */}
            <InfoSection title="About Me" content={user.personality || user.about} />
            <InfoSection title="Relationship Style" content={user.relationshipStyle} icon={Heart} />
            <InfoSection title="Personal View" content={user.personalView} icon={Globe} />
            <InfoSection title="Dating Preferences" content={user.lookingFor} icon={Sparkles} />

            {/* Music Anthem */}
            {(user.mainMusicTitle || user.musicRecommendation) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Musical Vibe</Text>
                {user.musicRecommendation && (
                   <Text style={[styles.sectionBody, {marginBottom: 15}]}>{user.musicRecommendation}</Text>
                )}
                {user.mainMusicTitle && (
                  <View style={styles.songCard}>
                    <Music size={24} color="#FFF" />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.songTitle}>{user.mainMusicTitle}</Text>
                      <Text style={styles.songArtist}>{user.mainMusicArtist || 'Featured Track'}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <InfoSection title="More About Me" content={user.extraInfo} icon={Star} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, profileTheme: ProfileTheme, dominantColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, zIndex: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: '#FFF' },
  closeBtn: { padding: 5 },
  scrollContent: { paddingBottom: 60 },
  heroImage: { width: '90%', height: 400, alignSelf: 'center', borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  mainContent: { padding: 25 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 20 },
  locationText: { fontSize: 16, color: '#FFF', opacity: 0.7, fontWeight: '600' },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  divider: { height: 1, backgroundColor: '#FFF', opacity: 0.15, marginVertical: 30 },
  section: { marginBottom: 35 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', color: '#FFF', opacity: 0.5 },
  sectionBody: { fontSize: 17, color: '#FFF', lineHeight: 24, fontWeight: '500' },
  songCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  songTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  songArtist: { fontSize: 14, color: '#FFF', opacity: 0.6 }
});