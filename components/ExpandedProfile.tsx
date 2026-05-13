import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { X, CheckCircle2, MapPin, Users, Globe, MessageCircle, Music, Mars, Venus,VenusAndMars, Briefcase, GraduationCap, Ruler, ListMusic, Tickets } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';
import { useState, useMemo } from 'react';
import UserPlaylist from '@/components/playlist';

const { width, height } = Dimensions.get('window');

interface ExpandedProfileProps {
    visible: boolean;
    onClose: () => void;
    profile: {
        id: number;
        name: string;
        age: number;
        location: string;
        gender?: string;
        height?: string;
        verified: boolean;
        image: string;
        work?: string;
        education?: string;
        relationshipStyle?: string;
        personalView?: string;
        personality?: string;
        musicRecommendation?: string;
    };
}

export default function ExpandedProfile({ visible, onClose, profile }: ExpandedProfileProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [isPlaylistVisible, setPlaylistVisible] = useState(false); 

const dummyPlaylist = [
    { 
      id: 1, 
      title: profile.musicRecommendation || 'Recommanded music', 
      artist: 'Unknown',
      coverImage: 'https://placehold.co/50'
    },
    { 
      id: 2, 
      title: 'Favorite Song 1', 
      artist: 'Artist A',
      coverImage: 'https://placehold.co/50'
    },
    { 
      id: 3, 
      title: 'Favorite Song 2', 
      artist: 'Artist B',
      coverImage: 'https://placehold.co/50'
    },
];

    return (
        <><Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Close Button */}
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <X size={28} color={colors.text} />
                </TouchableOpacity>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Image */}
                    <View style={styles.imageContainer}>
                        <Image
                            source={{ uri: profile.image }}
                            style={styles.profileImage} />
                    </View>

                    {/* Name and Verification */}
                    <View style={styles.nameContainer}>
                        <Text style={styles.name}>
                            {profile.name}
                        </Text>
                        {profile.verified && <CheckCircle2 size={28} color={colors.text} />}
                    </View>

                    {/* Quick Info Pills */}
                    <View style={styles.infoRow}>
                        <View style={styles.infoPill}>
                            <Users size={18} color={colors.text} />
                            <Text style={styles.infoPillText}>{profile.age}</Text>
                        </View>
                        {profile.gender && (
                            <View style={styles.infoPill}>
                                {profile.gender == 'male' ? (
                                    <Mars size={18} color={colors.text} />
                                ) : profile.gender == 'female' ? (
                                    <Venus size={18} color={colors.text} />
                                ) : (
                                    <VenusAndMars size={18} color={colors.text} />
                                )}
                                <Text style={styles.infoPillText}>{profile.gender}</Text>
                            </View>
                        )}
                        {profile.height && (
                            <View style={styles.infoPill}>
                                <Ruler size={18} color={colors.text} />
                                <Text style={styles.infoPillText}>{profile.height}</Text>
                            </View>
                        )}
                        {profile.work && (
                            <View style={styles.infoPill}>
                                <Briefcase size={18} color={colors.text} />
                                <Text style={styles.infoPillText}>{profile.work}</Text>
                            </View>
                        )}
                        {profile.education && (
                            <View style={styles.infoPill}>
                                <GraduationCap size={18} color={colors.text} />
                                <Text style={styles.infoPillText}>{profile.education}</Text>
                            </View>
                        )}
                        <View style={styles.infoPill}>
                            <MapPin size={18} color={colors.text} />
                            <Text style={styles.infoPillText}>{profile.location}</Text>
                        </View>
                    </View>

                    {/* Music Icons Row */}
                    <View style={styles.musicIconsRow}>
                        {/*<TouchableOpacity style={[styles.musicIcon, { backgroundColor: contentColor }]}>
        <MessageCircle size={24} color={bgColor} />
    </TouchableOpacity>*/}
                        <TouchableOpacity style={[styles.musicIcon, { backgroundColor: colors.text }]}>
                            <Music size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.musicIcon, { backgroundColor: colors.text }]}
                            onPress={() => setPlaylistVisible(true)}>
                            <ListMusic size={24} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.musicIcon, { backgroundColor: colors.text }]}>
                            <Tickets size={24} color={colors.primary} />
                        </TouchableOpacity>
                        {/*<TouchableOpacity style={[styles.musicIcon, { backgroundColor: contentColor }]}>
        <Music size={24} color={bgColor} />
    </TouchableOpacity>*/}
                    </View>

                    {/* Info Sections */}
                    {profile.relationshipStyle && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Relationship Style</Text>
                            <Text style={styles.sectionContent}>{profile.relationshipStyle}</Text>
                        </View>
                    )}

                    {profile.personalView && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Personal View on Dating</Text>
                            <Text style={styles.sectionContent}>{profile.personalView}</Text>
                        </View>
                    )}

                    {profile.personality && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>My Personality</Text>
                            <Text style={styles.sectionContent}> {profile.personality}</Text>
                        </View>
                    )}

                    {profile.musicRecommendation && (
                        <View style={styles.infoSection}>
                            <Text style={styles.sectionTitle}>Before we meet, you should listen to</Text>
                            <Text style={styles.sectionContent}>{profile.musicRecommendation}</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal><Modal
            visible={isPlaylistVisible}
            animationType='slide'
            transparent={false}
            onRequestClose={() => setPlaylistVisible(false)}>
                <UserPlaylist
                    user={{ id: profile.id, name: profile.name, image: profile.image }}
                    playlist={dummyPlaylist}
                    onClose={() => setPlaylistVisible(false)} />
            </Modal></>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.primary,
    },
    closeButton: {
        position: 'absolute',
        top: '2%',
        left: '5%',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.3)',
        zIndex: 10,
        elevation: 10
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 40,
        
    },
    imageContainer: {
        width: '60%',
        aspectRatio: 1,
        borderRadius: 30,
        overflow: 'hidden',
    },
    profileImage: {
        aspectRatio:1,
        width: '100%',
        height: '100%',
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
        gap: 5,
    },
    name: {
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 32,
        color: colors.text,
    },
    infoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        padding: 15,
        borderRadius: 20,
        marginBottom: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.32)',
    },
    infoPillText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    musicIconsRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    musicIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoSection: {
        width: '100%',
        padding: 20,
        borderRadius: 20,
        marginBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        color: colors.text,
        opacity:0.7,
    },
    sectionContent: {
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 20,
        color: colors.text, 
    },
});
