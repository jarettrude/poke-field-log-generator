# Data Processing and Prompt Engineering

This document details the data structures, processing pipeline, and prompt engineering techniques used to generate immersive Pokemon field researcher logs.

## PokeAPI Data Structure

### Raw PokeAPI Response

The application fetches data from two main PokeAPI endpoints:

#### 1. Pokémon Data (`/api/v2/pokemon/{id}`)

```typescript
{
  id: number,                    // National Pokédex ID
  name: string,                  // Pokémon name (lowercase)
  height: number,                // Height in decimeters (÷10 for meters)
  weight: number,                // Weight in hectograms (÷10 for kilograms)
  types: Array[{                 // Type information
    type: {
      name: string              // Type name (e.g., "fire", "water")
    }
  }],
  sprites: {
    front_default: string,       // PNG sprite URL
    other: {
      dream_world: {
        front_default: string    // SVG artwork URL
      }
    }
  },
  moves: Array[{                 // Move pool
    move: {
      name: string              // Move name (e.g., "flamethrower")
    }
  }],
  species: {
    url: string                  // Link to species endpoint
  }
}
```

#### 2. Species Data (`/api/v2/pokemon-species/{id}`)

```typescript
{
  habitat: {                     // Natural habitat (may be null)
    name: string                 // e.g., "forest", "cave", "sea"
  },
  flavor_text_entries: Array[{  // Descriptive lore text
    flavor_text: string,         // Game description
    language: {
      name: string              // Language code
    }
  }]
}
```

### Processed Data Structure

After fetching and processing, the application works with this simplified structure:

```typescript
interface PokemonDetails {
  id: number;                    // National Pokédex number (1-1025+)
  name: string;                  // Formatted name (e.g., "Charizard")
  height: number;                // Height in decimeters
  weight: number;                // Weight in hectograms
  types: string[];               // Array of type names
  imagePng: string | null;       // Local PNG path or remote URL
  imageSvg: string | null;       // Local SVG path or remote URL
  flavorTexts: string[];         // English flavor text entries
  allMoveNames: string[];        // Move names with spaces (e.g., "Flamethrower")
  habitat: string;               // Habitat or "the unknown wild"
  region?: string;               // Region name (Kanto, Johto, etc.)
}
```

## Data Processing Pipeline

### 1. Fetch & Cache
- **Primary Source**: PokeAPI (`https://pokeapi.co/api/v2`)
- **Caching**: SQLite database via `/api/pokemon/{id}` endpoint
- **Image Storage**: Local files in `/public/pokemon/{id}.png/.svg`

### 2. Data Transformation
- **Move Names**: Convert from kebab-case to space-separated (`"flame-wheel"` → `"flame wheel"`)
- **Flavor Text**: Filter to English only, remove line breaks
- **Habitat**: Use species habitat or default to `"the unknown wild"`
- **Region**: Mapped from generation ID (1=Kanto, 2=Johto, etc.)

### 3. Region Mapping
```typescript
const GENERATION_REGIONS: Record<number, string> = {
  1: 'Kanto',    2: 'Johto',    3: 'Hoenn',    4: 'Sinnoh',
  5: 'Unova',    6: 'Kalos',    7: 'Alola',    8: 'Galar',
  9: 'Paldea'
};
```

## Prompt System Usage

### Summary Generation Prompt

The summary prompt transforms raw Pokémon data into immersive field researcher logs using Gemini 2.0 Flash. The context template passed to the model:

```typescript
const pokemonContext = `
  ---
  ID: ${details.id}
  Name: ${details.name}
  Region: ${region}
  Types: ${details.types.join(', ')}
  Physicals: ${details.height / 10}m, ${details.weight / 10}kg
  Habitat: ${details.habitat}
  Lore Context: ${details.flavorTexts.join(' ')}
  Available Moves: ${details.allMoveNames.slice(0, 30).join(', ')}
`;
```

### Key Data Usage in Prompts

#### 1. **Log ID Format**
- **Source**: `details.id`
- **Usage**: Appropriate zero-padding based on range (1-99: no padding, 100-999: 3 digits, 1000+: 4+ digits)
- **Purpose**: Creates authentic Pokédex entry numbering

#### 2. **Narrative Context**
- **Name**: `${details.name}` - Pokémon identification
- **Region**: `${region}` - Geographic setting
- **Habitat**: `${details.habitat}` - Environmental context
- **Types**: `${details.types.join(', ')}` - Behavioral characteristics

#### 3. **Physical Description**
- **Height**: `${details.height / 10}m` - Size comparison
- **Weight**: `${details.weight / 10}kg` - Mass description
- **Usage**: Helps create vivid physical encounters

#### 4. **Lore Integration**
- **Source**: `${details.flavorTexts.join(' ')}`
- **Purpose**: Provides personality traits, behaviors, and background
- **Examples**: "Intense", "gentle", "mysterious" characteristics

#### 5. **Move Selection**
- **Source**: `${details.allMoveNames.slice(0, 30).join(', ')}`
- **Usage**: 2-4 moves woven into narrative as natural behaviors
- **Format**: Bolded in output (`**Flamethrower**`)
- **Example**: "I witnessed it unleash a devastating **Flame Wheel**"

### Text-to-Speech Prompt

The TTS prompt uses the generated summary text and adds director's notes for voice styling. Audio is generated using Gemini TTS with selectable voice profiles (Kore, Zephyr, Charon, Puck, Fenrir).

```typescript
const baseInstruction = `
[Director's Note]
Style: High-fidelity nature documentary narration. Professional field researcher recording a private observation log in a quiet environment.
Tone: Serene, melodic, and intimate. A female voice with a warm, resonant mid-range. Captivating and sophisticated; avoid theatrical or "announcer" tropes.
Delivery: Maintain a flat, authoritative cadence. Strictly avoid upward inflections (uptalk) at the end of sentences. No vocal fry.
Emphasis: Treat bolded terms with a slight, respectful weight—steady and clear, rather than excited.
Pacing: Slow, deliberate, and measured. Natural, brief pauses only at punctuation.
Technical: High-clarity audio. Ensure a clean "cold finish" immediately after the final word.
[/Director's Note]
`;
```

For bulk TTS (multiple summaries), entries are joined with `[PAUSE]` markers and the model is instructed to pause for 3 seconds at each marker.

## Data Flow Example

### Input Data
```json
{
  "id": 6,
  "name": "charizard",
  "height": 17,
  "weight": 905,
  "types": ["fire", "flying"],
  "habitat": "mountain",
  "flavorTexts": ["Spits fire that is hot enough...", "Its fiery breath reaches..."],
  "allMoveNames": ["flamethrower", "fire blast", "dragon rage", "wing attack"]
}
```

### Generated Context
```
---
ID: 6
Name: charizard
Region: Kanto
Types: fire, flying
Physicals: 1.7m, 90.5kg
Habitat: mountain
Lore Context: Spits fire that is hot enough... Its fiery breath reaches...
Available Moves: flamethrower, fire blast, dragon rage, wing attack
```

### Output Summary
```
"Pokémon trainer log 6. Today, I encountered a Charizard near a mountain within the Kanto region. The magnificent creature soared overhead, its massive 1.7m wingspan casting shadows across the rocky terrain. I watched in awe as it unleashed a devastating **Flamethrower**, the intense heat causing the very air to shimmer around us. Its fiery breath reached incredible temperatures, a testament to the power described in the research logs. The dragon-type Pokémon then demonstrated its agility with a swift **Wing Attack**, slicing through the mountain air with precision..."
```

## Prompt Customization

The prompt system supports customization via database storage:

- **Summary Prompt**: Controls narrative generation style and format
- **TTS Prompt**: Controls voice synthesis parameters and direction
- **Storage**: Stored in SQLite database via backend API
- **Management**: Full CRUD operations via `promptService.ts` (client) and `/api/prompts` (server)

This architecture allows for flexible AI generation while maintaining consistent data structures and caching for optimal performance.

## Storage Architecture

The application uses **SQLite database** (with WAL mode) for all persistent storage, organized into five main tables:

### 1. Pokemon Cache Table
```sql
CREATE TABLE pokemon_cache (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  height INTEGER NOT NULL,
  weight INTEGER NOT NULL,
  types TEXT NOT NULL,           -- JSON array
  habitat TEXT NOT NULL,
  flavor_texts TEXT NOT NULL,    -- JSON array
  move_names TEXT NOT NULL,      -- JSON array
  image_png_path TEXT,
  image_svg_path TEXT,
  cached_at TEXT NOT NULL
);
```

### 2. Summaries Table
```sql
CREATE TABLE summaries (
  id INTEGER PRIMARY KEY,        -- Pokemon ID
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  region TEXT NOT NULL,
  generation_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3. Audio Logs Table
```sql
CREATE TABLE audio_logs (
  id INTEGER PRIMARY KEY,        -- Pokemon ID
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  generation_id INTEGER NOT NULL,
  voice TEXT NOT NULL,           -- Voice profile used (e.g., "Kore")
  audio_base64 TEXT NOT NULL,    -- Base64-encoded audio data
  audio_format TEXT NOT NULL,    -- "pcm_s16le" or "wav"
  sample_rate INTEGER NOT NULL,  -- 24000 Hz
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 4. Prompts Table
```sql
CREATE TABLE prompts (
  type TEXT PRIMARY KEY,         -- 'summary' or 'tts'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5. Jobs Table
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,           -- UUID
  status TEXT NOT NULL,          -- 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled'
  stage TEXT NOT NULL,           -- 'summary' | 'audio'
  mode TEXT NOT NULL,            -- 'FULL' | 'SUMMARY_ONLY' | 'AUDIO_ONLY'
  generation_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  voice TEXT NOT NULL,
  total INTEGER NOT NULL,
  current INTEGER NOT NULL,
  message TEXT NOT NULL,
  cooldown_until TEXT,           -- ISO timestamp for rate-limit cooldown
  error TEXT,
  pokemon_ids TEXT NOT NULL,     -- JSON array of Pokemon IDs to process
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## API Integration

For complete API endpoint documentation, see [API Reference](./api-reference.md).

## Job-Based Processing

The application uses a background job runner for processing long-running AI operations:

1. **Client** creates a job with mode, generation, voice, and Pokemon IDs
2. **Job Runner** polls for queued jobs and processes them server-side
3. **Processing** happens with enforced cooldowns between API calls:
   - Summary generation: 15-second cooldown between each Pokemon
   - TTS generation: 5-minute cooldown between batches (up to 15 summaries per batch)
4. **Progress** is tracked in the database with real-time status updates
5. **Controls**: Jobs can be paused, resumed, or canceled at any time

For detailed architecture information, see [Technical Documentation](./technical-documentation.md).
