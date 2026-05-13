// services/musicService.ts

export interface ITunesSong {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
  primaryGenreName: string;
}

export const searchITunes = async (term: string): Promise<ITunesSong[]> => {
  if (!term || term.length < 2) return [];
  
  try {
    const encodedTerm = encodeURIComponent(term);
    // entity=song ensures we don't get movies or books
    const url = `https://itunes.apple.com/search?term=${encodedTerm}&entity=song&limit=15`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data.results || [];
  } catch (error) {
    console.error("iTunes API Error:", error);
    return [];
  }
};


export const getHighResArt = (url: string, size: number = 600) => {
  return url.replace('100x100bb', `${size}x${size}bb`);
};