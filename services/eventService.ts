import { XMLParser } from "fast-xml-parser";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from "./firebaseConfig";
import {
  collection, getDocs, writeBatch, doc, serverTimestamp, addDoc, getDoc, setDoc
} from "firebase/firestore";


export interface AppEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
  url: string;
  type: 'news' | 'event' | 'media' | 'match_update';
  creatorId?: string;
  isSaved?: boolean;
  isDeleted?: boolean;
  isPast?: boolean;
  fetchedAt?: number;
}

export interface RssSource {
  id: string;
  name: string;
  url: string;
  defaultType: 'news' | 'event' | 'media';
}


const CACHE_KEY = '@feed_cache';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const DEFAULT_RSS_SOURCES: RssSource[] = [
  { id: 'bb1', name: 'Billboard', url: 'https://www.billboard.com/feed/', defaultType: 'news' },
  { id: 'pf1', name: 'Pitchfork', url: 'https://pitchfork.com/feed/rss', defaultType: 'news' },
  { id: 'ra1', name: 'Resident Advisor', url: 'https://ra.co/xml/features', defaultType: 'media' }
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata"
});


const getStr = (val: any): string => {
  if (!val) return "";
  if (typeof val === 'string') return val;
  if (val.__cdata) return val.__cdata;
  if (val['#text']) return val['#text'];
  return String(val);
};


const generateIdFromUrl = (url: string): string => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16) + url.length.toString();
};

export const eventService = {


  async getUserFeeds(userId: string): Promise<RssSource[]> {
    if (!userId) return DEFAULT_RSS_SOURCES;
    try {
      const docSnap = await getDoc(doc(db, "users", userId));
      const data = docSnap.exists() ? docSnap.data() : null;
      if (data?.customFeeds && data.customFeeds.length > 0) {
        return data.customFeeds;
      }
    } catch (e) {
      console.error("Error fetching custom feeds:", e);
    }
    return DEFAULT_RSS_SOURCES;
  },

  async saveUserFeeds(userId: string, feeds: RssSource[]) {
    if (!userId) return;
    try {
      await setDoc(doc(db, "users", userId), { customFeeds: feeds }, { merge: true });
    } catch (e) {
      console.error("Error saving custom feeds:", e);
      throw e;
    }
  },


  async getEventsFromFirebase(userId: string): Promise<AppEvent[]> {
    if (!userId) return [];

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      let feed: AppEvent[] = cached ? JSON.parse(cached) : [];

      if (feed.length === 0) {
        const snapshot = await getDocs(collection(db, `users/${userId}/feed`));
        feed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppEvent));
      }

      const now = Date.now();
      const prunedFeed = feed.filter(event => {
        const isOld = event.fetchedAt && (now - event.fetchedAt > SEVEN_DAYS_MS);
        return event.isSaved || (!isOld && !event.isDeleted);
      });

        // proof of concept bc no api
      const pocEvent: AppEvent = {
        id: 'poc_event_001',
        title: 'MixMatch Live: Secret Warehouse Set',
        date: 'Coming Soon • 10:00 PM',
        location: 'Proof of Concept',
        description: '*** PROOF OF CONCEPT ***\n\nIn the production build, this tab will aggregate real concert tickets, local DJ sets, and festivals from public event feeds.\n\nYou can test the Invite flow right now! Tap the "Invite" button below to propose this as a date to one of your matches. It will send them a formal invitation in your chat.',
        image: 'https://images.unsplash.com/photo-hzgs56Ze49s?auto=format&fit=crop&w=800&q=80',
        url: '', 
        type: 'event',
        isSaved: false,
        isDeleted: false,
        fetchedAt: Date.now()
      };


      const finalFeed = [pocEvent, ...prunedFeed.filter(e => e.id !== pocEvent.id)];

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalFeed));
      return finalFeed;
    } catch (error) {
      console.error("DEBUG: Feed Load Error:", error);
      return [];
    }
  },


  async discoverEvents(userId: string): Promise<AppEvent[]> {
    if (!userId) throw new Error("Auth required to discover new content.");

    let allPosts: AppEvent[] = [];
    const sources = await this.getUserFeeds(userId);

    for (const source of sources) {
      try {
        const response = await fetch(source.url, {
          headers: {
            'Accept': 'application/rss+xml, application/xml, text/xml',
            'User-Agent': 'Mozilla/5.0 (compatible; MixMatchApp/1.0)'
          }
        });

        const xmlData = await response.text();
        const jsonObj = parser.parse(xmlData);

        let items = jsonObj?.rss?.channel?.item || jsonObj?.feed?.entry || [];
        if (!Array.isArray(items)) items = [items];

        const parsedItems = items.slice(0, 5).map((item: any) => {
          const rawDesc = getStr(item.description) || getStr(item.content);
          const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '').substring(0, 150).trim();

          let imageUrl = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80";

          const searchContent = [
            getStr(item['content:encoded']),
            getStr(item.content),
            getStr(item.description)
          ].join(' ');

          const lazySrcMatch = searchContent.match(/data-lazy-src="([^"]+)"/i);
          const standardSrcMatch = searchContent.match(/<img[^>]+src="([^">]+)"/i);

          if (item['media:thumbnail'] && item['media:thumbnail']['@_url']) {
            imageUrl = item['media:thumbnail']['@_url'];
          } else if (item['media:content'] && item['media:content']['@_url']) {
            imageUrl = item['media:content']['@_url'];
          } else if (item.enclosure && item.enclosure['@_url'] && String(item.enclosure['@_type']).includes('image')) {
            imageUrl = item.enclosure['@_url'];
          } else if (lazySrcMatch && lazySrcMatch[1]) {
            imageUrl = lazySrcMatch[1];
          } else if (standardSrcMatch && standardSrcMatch[1]) {
            imageUrl = standardSrcMatch[1];
          }

          const rawTitle = getStr(item.title);
          const cleanTitle = rawTitle.replace(/&#038;/g, '&').replace(/&#8216;/g, "'").replace(/&#8217;/g, "'").replace(/&#160;/g, " ");


          const uniqueUrl = item.link || item['@_href'] || cleanTitle;

          return {
            id: `rss_${generateIdFromUrl(uniqueUrl)}`, 
            title: cleanTitle,
            date: new Date(item.pubDate || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            location: source.name,
            description: cleanDesc + (cleanDesc.length >= 150 ? "..." : ""),
            image: imageUrl,
            url: uniqueUrl,
            type: source.defaultType as 'news' | 'event' | 'media',
            isSaved: false,
            isDeleted: false,
            isPast: false,
            fetchedAt: Date.now()
          };
        });

        allPosts = [...allPosts, ...parsedItems];
      } catch (e: any) {
        console.warn(`DEBUG: Failed to fetch/parse RSS from ${source.name}. Error: ${e.message}`);
      }
    }

    if (allPosts.length === 0) throw new Error("No updates found in media feeds right now.");


    const batch = writeBatch(db);
    allPosts.forEach((event) => {
      // Write to users/{userId}/feed instead of the global events collection
      const eventRef = doc(collection(db, `users/${userId}/feed`), event.id);
      batch.set(eventRef, event, { merge: true }); 
    });

    await batch.commit();

    // Save to Local Cache
    const existingCache = await AsyncStorage.getItem(CACHE_KEY);
    const currentFeed = existingCache ? JSON.parse(existingCache) : [];

    // Deduplicate cache just in case
    const mergedCache = [...allPosts, ...currentFeed];
    const uniqueCache = Array.from(new Map(mergedCache.map(item => [item.id, item])).values());

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(uniqueCache));

    return allPosts;
  },

  async shareWithConnection(eventId: string, senderId: string, receiverId: string) {
    return addDoc(collection(db, `users/${receiverId}/shared_posts`), {
      eventId,
      senderId,
      sharedAt: serverTimestamp(),
      read: false
    });
  },


  async broadcastMusicUpdate(user: { uid: string; name: string }, track: any, updateType: 'anthem' | 'playlist') {
    if (!user.uid) return;

    const newEvent: AppEvent = {
      id: `dna_${user.uid}_${Date.now()}`,
      title: updateType === 'anthem' ? `${user.name} set a new Anthem!` : `${user.name} updated their Musical DNA`,
      description: `${track.trackName} by ${track.artistName}`,
      location: 'Match Update',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      image: track.artworkUrl100?.replace('100x100bb', '600x600bb'),
      url: track.previewUrl || "",
      type: 'match_update',
      creatorId: user.uid,
      fetchedAt: Date.now()
    };

    // Note: Leaving this pushing to the global 'events' collection because these 
    // are meant to be seen by matches globally, not just in the user's private feed.
    await setDoc(doc(db, 'events', newEvent.id), newEvent);
  },
  // clear feed
  async clearUserFeed(userId: string) {
    if (!userId) return;

    try {
      // 1. Get all documents in the user's feed
      const feedRef = collection(db, `users/${userId}/feed`);
      const snapshot = await getDocs(feedRef);

      // 2. Delete them all in a batch
      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // 3. Wipe the local cache so ghost items don't reappear
      await AsyncStorage.removeItem(CACHE_KEY);

    } catch (error) {
      console.error("Error clearing user feed:", error);
      throw error;
    }
  },
};