// services/userService.ts
import { db } from "./firebaseConfig";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

export interface UserProfile {
  // Identity & Status
  uid: string;
  name: string;
  age: number;
  email: string;
  onboardingComplete: boolean;
  image: string;
  photos: string[];
  verified: boolean;

  // Profile Details
  location: string;
  latitude?: number;   
  longitude?: number;  
  height: string;
  heightFt: number;
  heightIn: number;
  gender: string;
  sexuality: string;
  pronouns: string;
  ethnicity: string;
  religion: string;
  languages: string[];
  personality: string;
  hobbies: string;

  // Career & Education
  work: string;
  jobTitle: string;
  school: string;
  education: string;

  // Lifestyle
  bodyType: string;
  drinking: string;
  smoking: string;
  drugs: string;
  workout: string;
  activeTime: string;

  // Intentions & Preferences
  mode: string[];
  datingIntentions: string;
  lookingFor: string;
  interestedIn: string[];
  preferredAgeMin: number;
  preferredAgeMax: number;
  maxDistance: number;

  // Music (Musical DNA)
  favoriteGenres: string[];
  favoriteArtists: string[];
  topSongs: any[];
  mainMusicTitle: string;
  mainMusicArtist: string;
  mainMusicImage: string;
  mainMusicPreview: string;

  // Settings & Privacy
  showOnlineStatus: boolean;
  showDistance: boolean;
  incognitoMode: boolean;
  readReceipts: boolean;
  pushEnabled: boolean;
  notifyMatches: boolean;
  notifyMessages: boolean;
  notifyLikes: boolean;
  notifyMusicUpdates: boolean;

  // Metadata
  updatedAt: string;
  createdAt: string;
}

export const userService = {
  sanitize(data: any): Partial<UserProfile> {
    const sanitized: any = {};

    // 1. Force Strings
    const strings = [
      'name', 'email', 'image', 'location', 'gender', 'sexuality',
      'pronouns', 'ethnicity', 'religion', 'personality', 'hobbies',
      'work', 'jobTitle', 'school', 'education',
      'bodyType', 'drinking', 'smoking', 'drugs', 'workout', 'activeTime',
      'datingIntentions', 'lookingFor', 'mainMusicTitle',
      'mainMusicArtist',
      'mainMusicImage',
      'mainMusicArt',
      'mainMusicPreview'
    ];
    strings.forEach(f => {
      if (data[f] !== undefined) sanitized[f] = String(data[f] || '');
    });


    if (data.bio || data.personality) {
      sanitized.personality = String(data.personality || data.bio || '');
    }

    // 3. Force Numbers (Integers)
    const numFields = [
      { key: 'age', default: 0 },
      { key: 'heightFt', default: 0 },
      { key: 'heightIn', default: 0 },
      { key: 'preferredAgeMin', alt: 'minAge', default: 18 },
      { key: 'preferredAgeMax', alt: 'maxAge', default: 65 },
      { key: 'maxDistance', alt: 'distance', default: 25 }
    ];

    numFields.forEach(f => {
      const val = data[f.key] !== undefined ? data[f.key] : data[f.alt || ''];
      if (val !== undefined) sanitized[f.key] = parseInt(val) || f.default;
    });

    // 4. Force Floats (GPS Coordinates) 
    if (data.latitude !== undefined && data.latitude !== null) {
      sanitized.latitude = parseFloat(data.latitude);
    }
    if (data.longitude !== undefined && data.longitude !== null) {
      sanitized.longitude = parseFloat(data.longitude);
    }

    // 5. Force Arrays
    const arrays = [
      'languages', 'favoriteGenres', 'favoriteArtists',
      'topSongs', 'mode', 'interestedIn', 'photos',
      'hiddenFields'
    ];
    arrays.forEach(f => {
      if (data[f] !== undefined) sanitized[f] = Array.isArray(data[f]) ? data[f] : [];
    });

    // 6. Force Booleans
    const bools = [
      'onboardingComplete', 'verified', 'showOnlineStatus',
      'showDistance', 'incognitoMode', 'readReceipts',
      'pushEnabled', 'notifyMatches', 'notifyMessages',
      'notifyLikes', 'notifyMusicUpdates'
    ];
    bools.forEach(f => {
      if (data[f] !== undefined) sanitized[f] = !!data[f];
    });

    // 7. Computed Fields
    sanitized.updatedAt = new Date().toISOString();
    if (sanitized.heightFt !== undefined || sanitized.heightIn !== undefined) {
      const ft = sanitized.heightFt ?? data.heightFt ?? 0;
      const inch = sanitized.heightIn ?? data.heightIn ?? 0;
      sanitized.height = `${ft}'${inch}"`;
    }

    return sanitized;
  },

  async createUserProfile(userId: string, data: any) {
    const userRef = doc(db, "users", userId);
    const sanitizedData = this.sanitize(data);
    return await setDoc(userRef, {
      ...sanitizedData,
      createdAt: new Date().toISOString(),
      uid: userId,
    });
  },

  async updateUserProfile(userId: string, data: any) {
    const userRef = doc(db, "users", userId);
    const sanitizedData = this.sanitize(data);
    return await setDoc(userRef, sanitizedData, { merge: true });
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const docSnap = await getDoc(doc(db, "users", userId));
      if (docSnap.exists()) {
        return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  }
};