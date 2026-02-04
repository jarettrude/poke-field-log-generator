# Pokedex Field Log Generator

Generate immersive, cinematic Pokemon field logs narrated like a nature documentary. Transform any Pokemon into a detailed researcher's observation with AI-generated narratives and professional voice narration.

![Pokedex Field Log Generator](./docs/Pokedex-Field-Log-Generator.png)

## Overview

The Pokedex Field Log Generator creates authentic field researcher logs for Pokemon, combining AI-generated narratives with high-quality text-to-speech narration. Each log reads like an entry from a naturalist's journal, complete with atmospheric descriptions, behavioral observations, and references to Pokemon abilities and habitats.

## Features

### Core Capabilities

- **AI-Generated Field Logs** - Rich, atmospheric narratives written from a field researcher's perspective, incorporating Pokemon lore, habitats, moves, and behaviors
- **Professional Voice Narration** - High-fidelity text-to-speech with multiple voice profiles (Kore, Zephyr, Charon, Puck, Fenrir)
- **Batch Processing** - Generate logs for entire Pokemon generations with background job processing
- **Summary Library** - Save, edit, export, and replay your generated content
- **Flexible Workflows** - Generate summaries only, audio only, or complete end-to-end logs

### Advanced Features

- **Job Control** - Pause, resume, and cancel long-running batch operations
- **Customizable Prompts** - Adjust AI writing style and voice direction
- **Local Storage** - All data stored locally in SQLite (no cloud dependencies)
- **Export/Import** - Backup and share your generated content

## Quick Start

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm
- Gemini API key (free tier available)

### Installation

1. **Get a Gemini API Key**
   
   Sign up at [Google AI Studio](https://aistudio.google.com/) to obtain your free API key.

2. **Clone the Repository**
   
   ```bash
   git clone https://github.com/jarettrude/poke-field-log-generator.git
   cd poke-field-log-generator
   ```

3. **Install Dependencies**
   
   ```bash
   pnpm install
   ```

4. **Configure API Key**
   
   Create a `.env.local` file in the project root:
   
   ```bash
   echo "GEMINI_API_KEY=your_key_here" > .env.local
   ```

5. **Start the Application**
   
   ```bash
   pnpm dev
   ```

6. **Access the Interface**
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Generating a Single Field Log

1. Navigate to the main interface
2. Select a Pokemon by ID or name
3. Choose a voice profile for narration
4. Click "Generate" to create the field log
5. Listen to the narration or export the text

### Batch Processing

1. Select "Batch Mode" from the interface
2. Choose a Pokemon generation (Kanto, Johto, etc.)
3. Select workflow mode:
   - **Full** - Generate both text and audio
   - **Summary Only** - Generate text logs only
   - **Audio Only** - Generate audio from existing summaries
4. Choose a voice profile
5. Start the batch job
6. Monitor progress with pause/resume/cancel controls

### Managing Your Library

- **View Summaries** - Browse all generated field logs by generation
- **Edit Content** - Modify generated text before creating audio
- **Regenerate Audio** - Create new narration with different voice profiles
- **Export Data** - Download summaries and audio files
- **Import Data** - Restore previously exported content

## Example Output

The application generates field logs like this:

### Bulbasaur Field Log

> Pokemon trainer log 1. Emerald blades of tall grass part silently, revealing a symbiotic marvel that blurs the line between flora and fauna. Here in the sun-drenched meadows bordering Kanto's Viridian Forest, the air smells of crushed clover and damp earth, a perfect sanctuary for the elusive Bulbasaur. The specimen before me is young, its turquoise skin dappled with darker patches that mimic the shifting shadows of the overhanging trees. Most striking, of course, is the bulbous green seed anchored firmly to its back—a living inheritance granted at the moment of its birth...

**Example Files:**

- [Text Log](./docs/example/0001-bulbasaur.md) - Complete field log narrative
- [Image](./docs/example/0001-bulbasaur.svg) - Pokemon artwork from PokeAPI
- [Audio](./docs/example/0001-bulbasaur.wav) - Professional narration (6MB WAV file)

## Technical Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI components
- **SQLite** - Local database with WAL mode
- **Gemini AI** - Text generation and text-to-speech
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Documentation

- [Technical Documentation](./docs/technical-documentation.md) - Architecture and implementation details
- [API Reference](./docs/api-reference.md) - Complete API endpoint documentation
- [Data Processing](./docs/pokeapi-data-and-prompts.md) - Data structures and prompt engineering

## Project Information

**Repository:** [https://github.com/jarettrude/poke-field-log-generator](https://github.com/jarettrude/poke-field-log-generator)

**License:** MIT

## Disclaimer

This project is a fan-made tool for personal entertainment and educational purposes only.

This project is not affiliated with, endorsed by, or connected to Nintendo, Creatures Inc., GAME FREAK inc., The Pokemon Company, or any of their subsidiaries or affiliates.

Pokemon and Pokemon character names are trademarks of Nintendo. Copyright 1995-2025 Nintendo/Creatures Inc./GAME FREAK inc.

All Pokemon data is sourced from [PokeAPI](https://pokeapi.co/), a free and open Pokemon RESTful API.
