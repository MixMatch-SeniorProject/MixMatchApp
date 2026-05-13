// services/mixtapeService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ITunesSong } from "./musicService";

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

// Use Gemini 1.5 Flash 
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: { responseMimeType: "application/json" } 
});

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface YouTubeTrack {
  title: string;
  artist: string;
  youtubeUrl: string;
}

export const mixtapeService = {
  async convertToYouTubeMixtape(songs: ITunesSong[]): Promise<YouTubeTrack[]> {
    if (!API_KEY) {
      console.error("Missing Gemini API Key in Mixtape Service");
      return [];
    }

    // Safety sleep to help avoid the 429 quota error if called immediately after another AI task
    await sleep(500);

    try {
      const songListText = songs.map(s => `"${s.trackName}" by ${s.artistName}`).join(", ");
      
      const prompt = `
        Create a shared mixtape JSON from these iTunes songs: [${songListText}].
        For each song, provide:
        1. "title": string
        2. "artist": string
        3. "youtubeUrl": A direct YouTube search link (e.g., https://www.youtube.com/results?search_query=Song+Artist)
        
        Return ONLY a JSON array.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonText = response.text();
      
      return JSON.parse(jsonText);
      
    } catch (error: any) {
      console.error("Error generating YouTube Mixtape via Gemini:", error);
      
      // Fallback: If AI fails or quota is hit, generate links manually so the UI doesn't break
      return songs.map(s => ({
        title: s.trackName,
        artist: s.artistName,
        youtubeUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(s.trackName + " " + s.artistName)}`
      }));
    }
  }
};