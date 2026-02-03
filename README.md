# Pokedex Field Log Generator

A Next.js application that generates immersive Pokémon field researcher logs using AI. Features a job-based processing system with pause/resume/cancel controls, server-side Gemini integration, and persistent SQLite storage.

## Disclaimer

This project is for personal entertainment and educational purposes only and is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc., or The Pokémon Company.

Pokémon and Pokémon character names are trademarks of Nintendo. 1995–2026 Nintendo/Creatures Inc./GAME FREAK inc.

## Features

- **AI-Generated Summaries**: Creates detailed, cinematic field researcher logs for any Pokémon using Gemini 2.0 Flash
- **Text-to-Speech**: Converts summaries to audio using Gemini TTS with selectable voice profiles
- **Job-Based Processing**: Background job runner with pause/resume/cancel controls and cooldown management
- **SQLite Database**: Persistent local storage for summaries, audio logs, Pokémon cache, and processing jobs
- **Workflow Modes**: Generate summaries only, audio only, or full end-to-end processing
- **Summary Library**: View, edit, export/import, and regenerate saved summaries and audio logs
- **Customizable Prompts**: Admin panel to override default summary and TTS prompts

## Getting Started

```bash
# Install dependencies
pnpm install

# Add your Gemini API key (server-side only)
echo "GEMINI_API_KEY=your_key_here" >> .env.local

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to start generating logs.

## Tech Stack

- **Next.js 16** - React framework with App Router and API routes
- **SQLite** (better-sqlite3) - Local database with WAL mode
- **Gemini AI** - Summary generation (gemini-2.0-flash) and TTS (gemini-2.5-flash-preview-tts)
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Project Structure

```
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # API routes
│   │   │   ├── audio/      # Audio log CRUD
│   │   │   ├── jobs/       # Job management (create, pause, resume, cancel)
│   │   │   ├── pokemon/    # Pokémon cache
│   │   │   ├── prompts/    # Prompt overrides
│   │   │   └── summaries/  # Summary CRUD
│   │   └── page.tsx        # Main client app
│   ├── components/         # React components (Header, views, overlays)
│   ├── services/           # Client-side service layer (API calls)
│   ├── lib/
│   │   ├── db/             # Database adapters (SQLite, MySQL)
│   │   └── server/         # Server-only modules (job runner, Gemini client)
│   ├── utils/              # Shared utilities
│   ├── types.ts            # TypeScript type definitions
│   └── constants.ts        # UI constants and rate-limit values
├── public/
│   └── pokemon/            # Downloaded sprite assets (auto-created)
└── pokemon_data.db         # SQLite database (auto-created)
```

## Architecture

The app uses a **job-based processing model**:

1. **Client** creates a job via `POST /api/jobs` with mode, generation, voice, and Pokémon IDs
2. **Job Runner** (`lib/server/jobRunner.ts`) polls for queued jobs and processes them server-side
3. **Progress** is tracked in the database; client polls `GET /api/jobs/:id` for updates
4. **Cooldowns** between API calls are enforced server-side to respect rate limits

## Environment Variables

| Variable         | Description                                  |
| ---------------- | -------------------------------------------- |
| `GEMINI_API_KEY` | Gemini API key for AI features (server-only) |
| `DB_TYPE`        | Database type: `sqlite` (default) or `mysql` |
