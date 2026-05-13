
<p align="center">
  <img src="assets/images/icon.png" width="128" alt="MixMatch Logo" />
</p>

<h1 align="center">MixMatch</h1>

<p align="center">
  <strong>Build meaningful connections through the universal language of music.</strong>
</p>

---
# MixMatch

**MixMatch** is a mobile app designed to help young adults build meaningful romantic or platonic connections through the universal language of music. Unlike traditional dating apps that often prioritize superficial appearance, MixMatch focuses on "Music DNA" to foster authentic relationships based on shared interests.

## Key Features

**AI-Powered "Music DNA" Matching**: Utilizes Google Gemini to analyze musical tastes and provide transparent compatibility scores and summaries.


**Multi-Intent Networking**: Toggle your discovery mode between **Date**, **Friend**, or **All** to clearly define your intentions.


**Integrated Event Discovery**: A dedicated feed for local music events and news, allowing users to invite matches to concerts directly from the app.


**Collaborative Mixtapes**: Create shared mixtapes that automatically map iTunes songs to YouTube playlists using AI.


**Interactive Messaging**: Engage in real-time chat with progression-based features, including voice calls that unlock after 100 messages.


**Second Chance Shuffle**: Revisit passed profiles once your discovery queue is exhausted, ensuring you don't miss a connection.



## Tech Stack

**Frontend**: React Native with Expo.


**Backend**: Firebase (Firestore & Authentication).


**Artificial Intelligence**: Google Gemini (1.5 Flash & 2.5 Flash).


**Music Data**: iTunes Search API.


**Audio**: `expo-av` for high-quality song previews.



## Setup and Installation

1. **Clone the Repository**:
```bash
git clone https://github.com/MixMatch-SeniorProject/MixMatchApp
cd MixMatchApp
```

2. **Install Dependencies**:
```bash
npm install
```


3. **Configure Environment Variables**:
Create a `.env` file in the root directory. **The app will not function without valid API keys.**

## ⚠️ Configuration (API Keys)

You must supply your own API keys for Firebase and Google Gemini. Create a `.env` file and include the following:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# AI Service Configuration
EXPO_PUBLIC_GEMINI_API_KEY=your_google_gemini_api_key
```

## Running the App

Start the Expo development server:

```bash
npx expo start
```

Use the Expo Go app on your physical device or an emulator to test the application.

## Development Team

**Group Members**: Dean Husan, Jennifer Kwon, Keerthi Kapavarapu, Rabdeep Singh.


**Advisor**: Dr. Wenjia Li.


**Project Website**: [MixMatch Website](https://mixmatch-seniorproject.github.io/mixmatch-website/).