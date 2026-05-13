//youtubeData.tsx

import axios from "axios";

//how we store songs and playlists internally, simple structure, will add to appwrite later
export type Song = {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
};

export type Playlist = {
  id: string;
  title: string;
  songIds: string[];
};

type Library = {
  songs: Record<string, Song>;
  playlists: Record<string, Playlist>;
};

// TODO: move this to .env before first build
//   THIS IS TEMP DO NOT PUSH ONCE WE HAVE A KEY!!!!!
const YOUTUBE_API_KEY = "";

/*
  This is our in-memory DB (will connect with appwrite later)
  Right now it resets when the app restarts
  If we need persistence later we’ll plug in AsyncStorage or just use appwrite
*/
const library: Library = {
  songs: {},
  playlists: {},
};

/*
  Pulls videoId and/or playlistId out of a YouTube URL.
  Handles both youtu.be links and full youtube.com links.
*/
function extractYouTubeIds(url: string): {
  videoId?: string;
  playlistId?: string;
} {
  try {
    const parsed = new URL(url);

    //youtu.be share links
    if (parsed.hostname.includes("youtu.be")) {
      return { videoId: parsed.pathname.slice(1) };
    }

    //Normal YouTube links
    if (parsed.hostname.includes("youtube.com")) {
      return {
        videoId: parsed.searchParams.get("v") || undefined,
        playlistId: parsed.searchParams.get("list") || undefined,
      };
    }

    return {};
  } catch {
    return {};
  }
}

/*
  Calls YouTube API for a single video and converts it into our format
*/
async function fetchVideo(videoId: string): Promise<Song> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY");
  }

  const response = await axios.get(
    "https://www.googleapis.com/youtube/v3/videos",
    {
      params: {
        id: videoId,
        key: YOUTUBE_API_KEY,
        part: "snippet",
      },
    }
  );

  const snippet = response.data.items[0]?.snippet;

  if (!snippet) {
    throw new Error("Video not found");
  }

  return {
    id: videoId,
    title: snippet.title,
    url: `https://youtu.be/${videoId}`,
    thumbnail: snippet.thumbnails?.default?.url,
  };
}

/*
  Fetches playlist info + every video inside it
  Handles pagination because YouTube only returns 50 at a time, annoying api lmao
*/
async function fetchPlaylist(
  playlistId: string
): Promise<{ playlist: Playlist; songs: Song[] }> {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY");
  }

  // First grab playlist metadata (just the title basically)
  const metaResponse = await axios.get(
    "https://www.googleapis.com/youtube/v3/playlists",
    {
      params: {
        id: playlistId,
        key: YOUTUBE_API_KEY,
        part: "snippet",
      },
    }
  );

  const meta = metaResponse.data.items[0]?.snippet;

  if (!meta) {
    throw new Error("Playlist not found");
  }

  const songs: Song[] = [];
  let nextPageToken: string | undefined = "";

  // Keep fetching until YouTube stops giving us pages
  while (nextPageToken !== undefined) {
    const itemsResponse = await axios.get(
      "https://www.googleapis.com/youtube/v3/playlistItems",
      {
        params: {
          playlistId,
          key: YOUTUBE_API_KEY,
          part: "snippet",
          maxResults: 50,
          pageToken: nextPageToken,
        },
      }
    );

    const items = itemsResponse.data.items;

    for (const item of items || []) {
      const id = item.snippet.resourceId.videoId;

      songs.push({
        id,
        title: item.snippet.title,
        url: `https://youtu.be/${id}`,
        thumbnail: item.snippet.thumbnails?.default?.url,
      });
    }

    nextPageToken = itemsResponse.data.nextPageToken;
  }

  return {
    playlist: {
      id: playlistId,
      title: meta.title,
      songIds: songs.map((s) => s.id),
    },
    songs,
  };
}

/*
  This is the only thing the UI needs to call to add content, user inputs (call method, and provide output)
  It figures out whether it's a video or playlist and updates the library by itself, front end doesn't need to worry :)
  This is all you need to plug into front end, simple as that!
*/
export const MusicBackend = {
  async addFromUrl(url: string): Promise<void> {
    const { videoId, playlistId } = extractYouTubeIds(url);

    //If it's a playlist, fetch everything inside it
    if (playlistId) {
      const { playlist, songs } = await fetchPlaylist(playlistId);

      library.playlists[playlist.id] = playlist;

      for (const song of songs) {
        library.songs[song.id] = song;
      }

      return;
    }

    // if just a single video use this
    if (videoId) {
      const song = await fetchVideo(videoId);
      library.songs[song.id] = song;
      return;
    }

    throw new Error("Invalid YouTube URL");
  },

  /*
    Returns playlists with actual song objects attached
    Makes it easier    for the UI to render without extra lookups
  */
  getAllPlaylists() {
    return Object.values(library.playlists).map((playlist) => ({
      playlist,
      songs: playlist.songIds.map((id) => library.songs[id]),
    }));
  },

  //Returns every song we currently have stored
  getAllSongs(): Song[] {
    return Object.values(library.songs);
  },

  //    Grab one playlist by ID
  getPlaylist(id: string) {
    const playlist = library.playlists[id];
    if (!playlist) return null;

    return {
      playlist,
      songs: playlist.songIds.map((sid) => library.songs[sid]),
    };
  },

  //for logout or testing, could add to final app if we want
  clearLibrary() {
    library.songs = {};
    library.playlists = {};
  },
};
