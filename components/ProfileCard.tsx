import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text, Avatar } from 'react-native-paper';

interface ProfileCardProps {
  name: string;
  about: string;
  interests: string[];
  genres: string[];
}

export default function ProfileCard({ name, about, interests, genres }: ProfileCardProps) {
  return (
    <View style={styles.profileCard}>
      <View style={styles.topHalf}>
        <Avatar.Icon size={120} icon="account" style={styles.avatar} />
      </View>

      <View style={styles.bottomHalf}>
        <Text variant="titleLarge" style={styles.profileName}>
          {name}
        </Text>
        <Text variant="bodyLarge" style={styles.about}>
          About: {about}
        </Text>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Interests
        </Text>
        <View style={styles.chipGroup}>
          {interests.map((interest) => (
            <Chip key={interest} style={styles.chip} mode="outlined" textStyle={styles.chipText}>
              {interest}
            </Chip>
          ))}
        </View>

        <Text variant="titleSmall" style={styles.sectionTitle}>
          Genres
        </Text>
        <View style={styles.chipGroup}>
          {genres.map((genre) => (
            <Chip
              key={genre}
              style={styles.chip}
              mode="flat"
              textStyle={[styles.chipText, { color: '#6200ee' }]}
            >
              {genre}
            </Chip>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  topHalf: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6200ee',
    paddingVertical: 20,
  },
  bottomHalf: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  avatar: {
    backgroundColor: 'white',
  },
  profileName: {
    fontWeight: '900',
    marginBottom: 12,
  },
  about: {
    marginBottom: 18,
    color: '#333',
    lineHeight: 24,
  },
  sectionTitle: {
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
    color: '#6200ee',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    marginRight: 10,
    marginBottom: 10,
    height: 36,
  },
  chipText: {
    fontSize: 16,
  },
});
