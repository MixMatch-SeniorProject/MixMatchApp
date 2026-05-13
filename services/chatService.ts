// services/chatService.ts
import { db } from "./firebaseConfig";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  orderBy, 
  limit, 
  updateDoc 
} from "firebase/firestore";

export const chatService = {
  /**
   * Fetches all conversations for the current user's inbox.
   * Handles presence (status dots), hidden status, and last message snippets.
   */
  async getInboxConversations(currentUserId: string) {
    if (!currentUserId) return [];

    try {
      const matchesQuery = query(
        collection(db, "matches"),
        where("users", "array-contains", currentUserId)
      );
      
      const matchesSnap = await getDocs(matchesQuery);
      
      const conversations = await Promise.all(
        matchesSnap.docs.map(async (matchDoc) => {
          const data = matchDoc.data();
          const matchId = matchDoc.id;
          const otherUserId = data.users.find((id: string) => id !== currentUserId);
          const userSnap = await getDoc(doc(db, "users", otherUserId));
          const userData = userSnap.exists() ? userSnap.data() : null;
          const isOtherPresent = !!(data.presence?.[otherUserId]);
          const isHidden = !!(data.hiddenBy?.[currentUserId]);
          const messagesRef = collection(db, "matches", matchId, "messages");
          const lastMessageQuery = query(messagesRef, orderBy("timestamp", "desc"), limit(1));
          const lastMessageSnap = await getDocs(lastMessageQuery);
          
          let lastMessageText = "Start chatting! 👋";
          let timestampStr = "";

          if (!lastMessageSnap.empty) {
            const msgData = lastMessageSnap.docs[0].data();
            
            if (msgData.type === 'text') {
               lastMessageText = msgData.text;
            } else if (msgData.type === 'playlist_add') {
               lastMessageText = `🎵 Added ${msgData.song?.title || 'a song'}`;
            } else if (msgData.type === 'playlist_remove') {
               lastMessageText = `🗑️ Removed a track`;
            } else if (msgData.type === 'playlist') {
               lastMessageText = "👤 Shared their Identity DNA";
            }
            
            // Formaat Timestamp
            if (msgData.timestamp) {
              const date = msgData.timestamp.toDate();
              timestampStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }

          return {
            id: matchId, 
            otherUserId: otherUserId,
            name: userData?.name || "Unknown",
            age: userData?.age || "",
            image: userData?.mainMusicArt || userData?.image || userData?.photos?.[0] || "",
            lastMessage: lastMessageText,
            timestamp: timestampStr,
            type: data.mode?.toLowerCase() === 'friend' ? 'friend' : 'date',
            isOtherPresent, // Boolean for Green/White dot
            isHidden       // Boolean for Hide/Restore logic
          };
        })
      );

      
      return conversations.filter(c => c.otherUserId);

    } catch (error) {
      console.error("Error fetching inbox conversations:", error);
      return [];
    }
  },

  /**
   * Toggles the "Hidden" status of a chat for the current user.
   * This allows "Deleting" a chat from view without actually deleting the history.
   */
  async toggleHideChat(matchId: string, userId: string, shouldHide: boolean) {
    try {
      const matchRef = doc(db, "matches", matchId);
      await updateDoc(matchRef, {
        [`hiddenBy.${userId}`]: shouldHide
      });
      return { success: true };
    } catch (error) {
      console.error("Error toggling chat visibility:", error);
      throw error;
    }
  }
};