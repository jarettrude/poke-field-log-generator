# Technical Documentation

This document covers the technical architecture, implementation details, and development guidelines for the Pokedex Field Log Generator.

## Architecture Overview

The application is built on Next.js 16 with a job-based processing architecture that handles long-running AI operations through a background job runner. All data is stored locally in SQLite with WAL mode for concurrent access.

### Core Components

**Frontend (Client-Side)**
- React 19 components with TypeScript
- Service layer for API communication
- Real-time job status polling
- Local state management

**Backend (Server-Side)**
- Next.js API routes
- Background job runner with cooldown management
- Gemini AI integration (text generation and TTS)
- SQLite database with better-sqlite3

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── audio/           # Audio log CRUD operations
│   │   ├── jobs/            # Job management endpoints
│   │   ├── pokemon/         # Pokemon data caching
│   │   ├── prompts/         # Prompt customization
│   │   └── summaries/       # Summary CRUD operations
│   ├── page.tsx             # Main application interface
│   └── layout.tsx           # Root layout
├── components/
│   ├── Header.tsx           # Application header
│   ├── views/               # Main view components
│   └── overlays/            # Modal and overlay components
├── services/
│   ├── audioService.ts      # Audio log API client
│   ├── jobService.ts        # Job management API client
│   ├── pokemonService.ts    # Pokemon data API client
│   ├── promptService.ts     # Prompt API client
│   └── summaryService.ts    # Summary API client
├── lib/
│   ├── db/
│   │   ├── sqlite.ts        # SQLite database adapter
│   │   └── mysql.ts         # MySQL database adapter (optional)
│   └── server/
│       ├── jobRunner.ts     # Background job processor
│       ├── geminiClient.ts  # Gemini AI client wrapper
│       └── prompts.ts       # Default prompt templates
├── utils/
│   ├── pokemon.ts           # Pokemon data utilities
│   └── audio.ts             # Audio processing utilities
├── types.ts                 # TypeScript type definitions
└── constants.ts             # Application constants
```

## Database Schema

The application uses SQLite with five main tables:

### pokemon_cache

Stores fetched Pokemon data from PokeAPI to minimize API calls.

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

### summaries

Stores generated field log narratives.

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

### audio_logs

Stores generated audio narrations.

```sql
CREATE TABLE audio_logs (
  id INTEGER PRIMARY KEY,        -- Pokemon ID
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  generation_id INTEGER NOT NULL,
  voice TEXT NOT NULL,           -- Voice profile (Kore, Zephyr, etc.)
  audio_base64 TEXT NOT NULL,    -- Base64-encoded audio data
  audio_format TEXT NOT NULL,    -- "pcm_s16le" or "wav"
  sample_rate INTEGER NOT NULL,  -- 24000 Hz
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### prompts

Stores custom prompt overrides.

```sql
CREATE TABLE prompts (
  type TEXT PRIMARY KEY,         -- 'summary' or 'tts'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### jobs

Tracks background processing jobs.

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
  cooldown_until TEXT,           -- ISO timestamp
  error TEXT,
  pokemon_ids TEXT NOT NULL,     -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Job Processing System

The job-based architecture handles long-running AI operations without blocking the UI.

### Job Lifecycle

1. **Creation** - Client creates job via `POST /api/jobs`
2. **Queuing** - Job enters queue with status `queued`
3. **Processing** - Job runner picks up job and sets status to `running`
4. **Progress** - Job updates progress and status in database
5. **Completion** - Job finishes with status `completed`, `failed`, or `canceled`

### Job Runner

The background job runner (`lib/server/jobRunner.ts`) polls for queued jobs every second and processes them sequentially.

**Key Features:**
- Automatic cooldown management between API calls
- Pause/resume/cancel support
- Error handling and retry logic
- Progress tracking

**Cooldown Periods:**
- Summary generation: 15 seconds between Pokemon
- TTS generation: 5 minutes between batches (up to 15 summaries per batch)

### Job Control

Jobs can be controlled through API endpoints:

- `POST /api/jobs/{id}/pause` - Pause a running job
- `POST /api/jobs/{id}/resume` - Resume a paused job
- `POST /api/jobs/{id}/cancel` - Cancel a job

## Gemini AI Integration

The application uses Google's Gemini AI for both text generation and text-to-speech.

### Text Generation

**Model:** gemini-2.0-flash

**Configuration:**
- Temperature: 0.7
- Max output tokens: 2048
- Safety settings: Block only high-probability harmful content

**Prompt Structure:**
```
[System Instructions]
You are a field researcher documenting Pokemon encounters...

[Pokemon Context]
ID: {id}
Name: {name}
Region: {region}
Types: {types}
Physicals: {height}m, {weight}kg
Habitat: {habitat}
Lore Context: {flavor_texts}
Available Moves: {moves}
```

### Text-to-Speech

**Model:** gemini-2.5-flash-preview-tts

**Configuration:**
- Sample rate: 24000 Hz
- Format: PCM 16-bit signed little-endian
- Voice profiles: Kore, Zephyr, Charon, Puck, Fenrir

**Director's Notes:**
The TTS prompt includes detailed director's notes for voice styling:
- Style: Nature documentary narration
- Tone: Serene, melodic, intimate
- Delivery: Flat, authoritative cadence
- Pacing: Slow, deliberate, measured

## Data Flow

### Pokemon Data Fetching

1. Client requests Pokemon data via `GET /api/pokemon/{id}`
2. Server checks cache in database
3. If not cached:
   - Fetch from PokeAPI (`/api/v2/pokemon/{id}`)
   - Fetch species data (`/api/v2/pokemon-species/{id}`)
   - Download and save sprite images
   - Store in database cache
4. Return processed data to client

### Summary Generation

1. Client creates job with mode `FULL` or `SUMMARY_ONLY`
2. Job runner fetches Pokemon data
3. Constructs prompt with Pokemon context
4. Calls Gemini API for text generation
5. Saves summary to database
6. Updates job progress

### Audio Generation

1. Client creates job with mode `FULL` or `AUDIO_ONLY`
2. Job runner fetches existing summaries
3. Batches up to 15 summaries with `[PAUSE]` markers
4. Constructs TTS prompt with director's notes
5. Calls Gemini TTS API
6. Saves audio to database as base64
7. Updates job progress

## Environment Configuration

### Required Variables

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Optional Variables

```bash
DB_TYPE=sqlite                 # Database type (sqlite or mysql)
```

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local

# Add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" >> .env.local

# Run development server
pnpm dev
```

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm type-check   # Run TypeScript type checking
pnpm format       # Format code with Prettier
pnpm format:check # Check code formatting
pnpm check        # Run all checks (type-check, lint, format)
pnpm fix          # Fix all auto-fixable issues
```

### Code Style

The project uses:
- **ESLint** - Code linting with Next.js config
- **Prettier** - Code formatting with Tailwind CSS plugin
- **TypeScript** - Strict type checking

## Performance Considerations

### Caching Strategy

- Pokemon data cached indefinitely in database
- Sprite images saved to `/public/pokemon/` directory
- No external API calls for cached data

### Rate Limiting

- Summary generation: 15-second cooldown between requests
- TTS generation: 5-minute cooldown between batches
- Cooldowns enforced server-side in job runner

### Database Optimization

- SQLite WAL mode for concurrent reads
- Indexed primary keys for fast lookups
- JSON columns for array data storage

## Security

### API Key Protection

- Gemini API key stored in `.env.local` (server-side only)
- Never exposed to client-side code
- All AI operations performed server-side

### Input Validation

- Pokemon IDs validated against known ranges
- Job parameters validated before processing
- SQL injection protection via parameterized queries

## Deployment

### Production Build

```bash
pnpm build
pnpm start
```

### Environment Setup

Ensure `.env.local` contains your Gemini API key in production.

### Database

The SQLite database file (`pokemon_data.db`) is created automatically on first run. Ensure the application has write permissions to the project directory.

## Troubleshooting

### Common Issues

**Job stuck in "running" state:**
- Check job runner is active
- Verify Gemini API key is valid
- Check for rate limit errors in logs

**Missing Pokemon images:**
- Ensure `/public/pokemon/` directory is writable
- Check PokeAPI availability
- Verify sprite URLs are accessible

**Audio playback issues:**
- Confirm browser supports WAV format
- Check audio data is properly base64 encoded
- Verify sample rate is 24000 Hz

## Future Enhancements

Potential areas for expansion:

- MySQL database adapter for multi-user deployments
- Custom voice profile training
- Advanced prompt engineering interface
- Batch export to multiple formats
- Integration with additional Pokemon data sources
