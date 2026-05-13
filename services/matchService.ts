// services/matchService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./firebaseConfig";
import {
  collection, doc, getDocs, getDoc, setDoc,
  query, where, serverTimestamp, deleteDoc
} from "firebase/firestore";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: { responseMimeType: "application/json" }
});

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const calculateDistance = (lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 9999;
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const matchService = {
  // ==========================================
  // 1. THE DISCOVERY ENGINE
  // ==========================================
  async getEligibleProfiles(currentUser: any, mode: 'All' | 'Date' | 'Friend') {
    if (!currentUser?.uid) return [];

    try {
      const swipedIds = await this.getSwipedIds(currentUser.uid);
      swipedIds.push(currentUser.uid);

      const likedMeQuery = query(
        collection(db, "interactions"),
        where("toUserId", "==", currentUser.uid),
        where("action", "==", "like")
      );
      const likedMeSnap = await getDocs(likedMeQuery);
      const likedMeIds = likedMeSnap.docs.map(doc => doc.data().fromUserId);

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("onboardingComplete", "==", true));
      const snapshot = await getDocs(q);

      const eligibleProfiles: any[] = [];

      snapshot.forEach((docSnap) => {
        const potential = { id: docSnap.id, ...docSnap.data() } as any;

        if (swipedIds.includes(potential.id)) return;

        // 1. Verify Mutual Intentions 
        const mutualDating = currentUser.mode?.includes('Dating') && potential.mode?.includes('Dating');
        const mutualFriends = currentUser.mode?.includes('Friends') && potential.mode?.includes('Friends');

        const isDateMatch = mutualDating && (mode === 'Date' || mode === 'All');
        const isFriendMatch = mutualFriends && (mode === 'Friend' || mode === 'All');

        // If neither of intentions align for this tab, skip 
        if (!isDateMatch && !isFriendMatch) return;

        // 2. Strict Gender Matching 
        const genderMatchForMe = currentUser.interestedIn?.includes('Everyone') || currentUser.interestedIn?.includes(potential.gender);
        const genderMatchForThem = potential.interestedIn?.includes('Everyone') || potential.interestedIn?.includes(currentUser.gender);

        // If the gender preference is not mutual, reject them before AI scoring.
        if (!genderMatchForMe || !genderMatchForThem) return;

        const ageOkForMe = potential.age >= currentUser.preferredAgeMin && potential.age <= currentUser.preferredAgeMax;
        const ageOkForThem = currentUser.age >= (potential.preferredAgeMin || 18) && currentUser.age <= (potential.preferredAgeMax || 65);
        if (!ageOkForMe || !ageOkForThem) return;

        const distanceMiles = calculateDistance(
          currentUser.latitude,
          currentUser.longitude,
          potential.latitude,
          potential.longitude
        );

        if (distanceMiles > (currentUser.maxDistance || 50)) return;
        if (distanceMiles > (potential.maxDistance || 50)) return;

        potential.distanceAway = Math.max(1, Math.round(distanceMiles));
        potential.hasLikedMe = likedMeIds.includes(potential.id);
        eligibleProfiles.push(potential);
      });

      return eligibleProfiles;

    } catch (error) {
      console.error("Error fetching eligible profiles:", error);
      return [];
    }
  },

  // ==========================================
  // 2. THE SWIPE HANDSHAKE
  // ==========================================
  async recordInteraction(currentUserId: string, targetUserId: string, action: 'like' | 'pass', mode: string) {
    try {
      const interactionId = `${currentUserId}_${targetUserId}`;
      const interactionRef = doc(db, "interactions", interactionId);

      await setDoc(interactionRef, {
        fromUserId: currentUserId,
        toUserId: targetUserId,
        action,
        mode,
        timestamp: serverTimestamp()
      });

      if (action === 'pass') return { match: false };

      const reciprocalId = `${targetUserId}_${currentUserId}`;
      const reciprocalDoc = await getDoc(doc(db, "interactions", reciprocalId));

      if (reciprocalDoc.exists() && reciprocalDoc.data()?.action === 'like') {
        const matchId = [currentUserId, targetUserId].sort().join('_');

        await setDoc(doc(db, "matches", matchId), {
          users: [currentUserId, targetUserId],
          mode: mode,
          timestamp: serverTimestamp()
        });

        return { match: true };
      }

      return { match: false };
    } catch (error) {
      console.error("Error recording interaction:", error);
      throw error;
    }
  },

  // ==========================================
  // 3. CONNECTION MANAGEMENT
  // ==========================================
  async removeConnection(currentUserId: string, targetUserId: string, type: 'match' | 'like') {
    try {
      if (type === 'match') {
        const matchId = [currentUserId, targetUserId].sort().join('_');
        await deleteDoc(doc(db, "matches", matchId));
        await deleteDoc(doc(db, "interactions", `${currentUserId}_${targetUserId}`));
        await deleteDoc(doc(db, "interactions", `${targetUserId}_${currentUserId}`));
      } else {
        await deleteDoc(doc(db, "interactions", `${targetUserId}_${currentUserId}`));
      }
      return { success: true };
    } catch (error) {
      console.error("Error removing connection:", error);
      throw error;
    }
  },

  //UNDO REJECTS
  async undoPasses(userId: string) {
    try {
      const passesQuery = query(
        collection(db, "interactions"),
        where("fromUserId", "==", userId),
        where("action", "==", "pass")
      );
      const snapshot = await getDocs(passesQuery);

      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "interactions", d.id)));
      await Promise.all(deletePromises);

      return { success: true, count: snapshot.docs.length };
    } catch (error) {
      console.error("Error undoing passes:", error);
      throw error;
    }
  },

  async getSwipedIds(userId: string) {
    const q = query(collection(db, "interactions"), where("fromUserId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().toUserId);
  },

  async getConnectionProfiles(currentUserId: string) {
    try {
      const likedYouQuery = query(collection(db, "interactions"),
        where("toUserId", "==", currentUserId),
        where("action", "==", "like")
      );
      const likedYouSnap = await getDocs(likedYouQuery);

      // 1. Map the User ID to the EXACT mode they swiped with
      const interactionMap = new Map<string, string>();
      likedYouSnap.docs.forEach(d => {
        const data = d.data();
        interactionMap.set(data.fromUserId, data.mode);
      });

      const matchesQuery = query(collection(db, "matches"),
        where("users", "array-contains", currentUserId)
      );
      const matchesSnap = await getDocs(matchesQuery);

      // 2. Map the matches to the exact mode the match was created under
      const matchMap = new Map<string, string>();
      matchesSnap.docs.forEach(d => {
        const data = d.data();
        const users = data.users;
        const otherId = users[0] === currentUserId ? users[1] : users[0];
        matchMap.set(otherId, data.mode);
      });

      const matchedIds = Array.from(matchMap.keys());
      const pureLikedYouIds = Array.from(interactionMap.keys()).filter(id => !matchMap.has(id));

      const fetchProfiles = async (ids: string[], modeMap: Map<string, string>) => {
        if (ids.length === 0) return [];
        const profiles = [];
        for (const id of ids) {
          const docSnap = await getDoc(doc(db, "users", id));
          if (docSnap.exists()) {
            profiles.push({
              id: docSnap.id,
              ...docSnap.data(),
              connectionMode: modeMap.get(id) // STAMP
            });
          }
        }
        return profiles;
      };

      return {
        likedYou: await fetchProfiles(pureLikedYouIds, interactionMap),
        matches: await fetchProfiles(matchedIds, matchMap)
      };

    } catch (error) {
      console.error("Error fetching connections:", error);
      return { likedYou: [], matches: [] };
    }
  },

  // ==========================================
  // 4. AI SCORING
  // ==========================================
  async getAiCompatibility(currentUser: any, potentialMatch: any, mode: string) {
    if (!API_KEY) return this.getQuickMatch(currentUser, potentialMatch);
    await sleep(800);

    const mutualSignal = potentialMatch.hasLikedMe
      ? "They have already liked you. Give a slight bump to the score for mutual vibe."
      : "";

    const prompt = `
      You are a music matching algorithm. Compare your tastes with their tastes to determine compatibility percentage (0-100) for a ${mode} connection.
      ${mutualSignal}
      You: Genres [${currentUser.favoriteGenres?.join(', ')}], Artists [${currentUser.favoriteArtists?.join(', ')}]
      Them: Genres [${potentialMatch.favoriteGenres?.join(', ')}], Artists [${potentialMatch.favoriteArtists?.join(', ')}]
      
      Return strictly in this JSON format: 
      {
        "score": number, 
        "reason": "Write a short 1-2 sentence summary explaining why your and their music tastes complement each other. DO NOT use 'User A' or 'User B'. Use 'you' and 'them'/'their'.",
        "tags": [
          {"text": "Genre or Artist Name", "type": "genre", "matchLevel": "exact"},
          {"text": "Genre or Artist Name", "type": "artist", "matchLevel": "close"}
        ],
        "thinking": "internal logic"
      }
      
      Rules for tags:
      - The 'text' for the tags MUST come from THEIR (Them) list of genres and artists. You are showcasing what THEY like.
      - Return AT LEAST 3 tags total representing THEIR profile.
      - Must include at least 1 'genre' tag and at least 1 'artist' tag from THEIR profile.
      - 'matchLevel' MUST be one of: "exact" (you both like it), "close" (similar vibe), or "unrelated" (distinctly different, they like it but you don't).
    `;

    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      return this.getQuickMatch(currentUser, potentialMatch);
    }
  },

  getQuickMatch(currentUser: any, potentialMatch: any) {
    const commonGenres = currentUser.favoriteGenres?.filter((g: string) =>
      potentialMatch.favoriteGenres?.includes(g)
    ) || [];
    const baseScore = potentialMatch.hasLikedMe ? 65 : 45;
    const totalScore = baseScore + (commonGenres.length * 15);

    // Ensure the fallback also prioritizes Their tastes
    const fallbackTags = [
      { text: commonGenres[0] || potentialMatch.favoriteGenres?.[0] || "Music", type: "genre", matchLevel: commonGenres.length > 0 ? "exact" : "unrelated" },
      { text: potentialMatch.favoriteArtists?.[0] || "Unknown Artist", type: "artist", matchLevel: "close" },
      { text: potentialMatch.favoriteGenres?.[1] || "Vibes", type: "genre", matchLevel: "unrelated" }
    ];

    return {
      score: Math.min(totalScore, 98),
      reason: `You both share a deep appreciation for ${commonGenres[0] || 'similar rhythms'}. ${potentialMatch.hasLikedMe ? 'They already show interest in your vibe!' : 'Your musical DNA has strong overlap.'}`,
      tags: fallbackTags,
      thinking: ''
    };
  }
};