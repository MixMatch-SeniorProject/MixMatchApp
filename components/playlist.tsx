import React, { useMemo } from 'react';
import {View, Text, Image, StyleSheet, TouchableOpacity, FlatList, Modal } from 'react-native';
import { Bookmark, X } from 'lucide-react-native';
import { useTheme } from '@/constants/themeHelper';

interface Track {
  id: number;
  title: string;
  artist: string;
  coverImage: string;
}

interface User {
  id?: number;
  name: string;
  image: string;
}

interface UserPlaylistProps {
  user: User;
  playlist: Track[];
  visible: boolean;
  onClose: () => void;
}

const UserPlaylist = ({ user, playlist, visible, onClose }: UserPlaylistProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContainer}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: user.image }} style={styles.profileImage} />
          </View>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.playlistTitle}>{user.name}'s Playlist</Text>
        </View>

        <View style={styles.playlistContainer}>
          <FlatList
            data={playlist}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.musicBox} activeOpacity={0.8}>
                <View style={styles.songInfoSection}>
                  <Text style={styles.sectionTitle}>{item.title}</Text>
                  <Text style={styles.sectionArtist}>{item.artist}</Text>
                </View>
                <Bookmark size={20} color={colors.text} />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

export default UserPlaylist;

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 20,
      paddingHorizontal: 15,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 8,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
    },
    imageWrapper: {
      aspectRatio: 1,
      width: '50%',
      borderRadius: 20,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
    },
    titleContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 15,
    },
    playlistTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      color: colors.text,
    },
    playlistContainer: {
      flex: 1,
      width: '100%',
    },
    musicBox: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.text + '10',
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 15,
      marginBottom: 10,
    },
    songInfoSection: {
      flexDirection: 'column',
      justifyContent: 'center',
      flex: 1,
      marginRight: 15,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      marginBottom: 4,
      color: colors.text,
    },
    sectionArtist: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
      opacity: 0.7,
    },
  });