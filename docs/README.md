# Pokédex Field Log Generator

An immersive, high-fidelity archival system that transforms raw Pokémon biological data into cinematic field researcher observations with professional voice narration.

## Overview

This application functions as a **Deep Archive Console** for a Pokémon Field Researcher. It generates "Mission Logs"—personal, narrative field notes that describe encounters in the wild with a professional, nature-documentary delivery.

## Features

### Two-Stage Pipeline

- **Summary Generation:** Creates individual text summaries for each Pokémon
- **Audio Synthesis:** Batches summaries (up to 15) into TTS calls for efficiency
- **Individual Review:** Edit or regenerate summaries before audio generation

### Multi-View Architecture

| View           | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| **Home**       | Select workflow mode (Full, Summary-only, Audio-only)    |
| **Generation** | Select Pokémon by generation, range, or individual picks |
| **Library**    | View, edit, export/import saved summaries                |
| **Settings**   | Customize AI prompts with live preview                   |

### API Optimization

- **Dynamic Cooldowns:** Adjusts wait times based on API responses
- **Exponential Backoff:** Handles 500 errors with increasing delays + jitter
- **Rate Limit Awareness:** TTS batching maximizes daily quota usage

### Persistence

- **IndexedDB Storage:** Summaries persist across sessions
- **JSON Export/Import:** Backup and share your library
- **Prompt Overrides:** Custom prompts saved to localStorage

## UI/UX Design

The interface evokes a sophisticated scientific terminal:

- **Pokéball Red Theme:** Custom color system for authentic feel
- **Playfair Display + Inter:** Scholarly yet technical typography
- **Progress Overlay:** Countdown timers, flavor text, summary previews

## Dual AI Pipeline

### 1. Narrative Synthesis (Gemini 2.0 Flash)

- Generates 200-250 word "Mission Logs"
- Uses "witness" format: _"Today, I encountered a [Name] near [Habitat]..."_
- Weaves 2-4 moves into narrative as natural behaviors
- Includes regional context (Kanto, Johto, etc.)

### 2. Voice Synthesis (Gemini 2.5 Flash Preview TTS)

- Nature documentary style narration
- Multiple voice profiles available
- 3-second pauses between batched entries
- High-fidelity audio output

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** with Tailwind CSS v4
- **Google Gemini API** for AI generation
- **PokeAPI** for Pokémon data
- **IndexedDB** for persistence

## Getting Started

```bash
# Install dependencies
pnpm install

# Set your API key
echo "GEMINI_API_KEY=your-key-here" > .env.local

# Run development server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start generating field logs.

## Workflow Tips

1. **Start with Summary Only** - Generate all text first
2. **Review in Library** - Edit or regenerate any entries
3. **Batch Audio** - Generate audio from saved summaries
4. **Export for Backup** - Save your library as JSON
