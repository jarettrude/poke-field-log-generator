# API Reference

Complete reference for all API endpoints in the Pokedex Field Log Generator.

## Base URL

All API endpoints are relative to the application root:

```
http://localhost:3000/api
```

## Response Format

All endpoints return JSON responses with appropriate HTTP status codes.

**Success Response:**
```json
{
  "data": { ... }
}
```

**Error Response:**
```json
{
  "error": "Error message description"
}
```

## Endpoints

### Jobs

Manage background processing jobs for batch generation.

#### Create Job

Create a new processing job.

```http
POST /api/jobs
```

**Request Body:**
```json
{
  "mode": "FULL" | "SUMMARY_ONLY" | "AUDIO_ONLY",
  "generationId": number,
  "voice": "Kore" | "Zephyr" | "Charon" | "Puck" | "Fenrir",
  "pokemonIds": number[]
}
```

**Response:**
```json
{
  "id": "uuid-string",
  "status": "queued",
  "stage": "summary",
  "mode": "FULL",
  "generationId": 1,
  "region": "Kanto",
  "voice": "Kore",
  "total": 151,
  "current": 0,
  "message": "Job created",
  "pokemonIds": [1, 2, 3, ...],
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Get Job Status

Retrieve current status and progress of a job.

```http
GET /api/jobs/{id}
```

**Response:**
```json
{
  "id": "uuid-string",
  "status": "running" | "queued" | "paused" | "completed" | "failed" | "canceled",
  "stage": "summary" | "audio",
  "mode": "FULL",
  "generationId": 1,
  "region": "Kanto",
  "voice": "Kore",
  "total": 151,
  "current": 45,
  "message": "Processing Pokemon 45 of 151",
  "cooldownUntil": "2025-01-15T12:05:00.000Z" | null,
  "error": null | "Error message",
  "pokemonIds": [1, 2, 3, ...],
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:05:00.000Z"
}
```

#### Pause Job

Pause a running job.

```http
POST /api/jobs/{id}/pause
```

**Response:**
```json
{
  "id": "uuid-string",
  "status": "paused",
  "message": "Job paused"
}
```

#### Resume Job

Resume a paused job.

```http
POST /api/jobs/{id}/resume
```

**Response:**
```json
{
  "id": "uuid-string",
  "status": "queued",
  "message": "Job resumed"
}
```

#### Cancel Job

Cancel a job.

```http
POST /api/jobs/{id}/cancel
```

**Response:**
```json
{
  "id": "uuid-string",
  "status": "canceled",
  "message": "Job canceled"
}
```

### Pokemon

Fetch and cache Pokemon data from PokeAPI.

#### Get Pokemon Data

Retrieve cached Pokemon data or fetch from PokeAPI.

```http
GET /api/pokemon/{id}
```

**Response:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "height": 7,
  "weight": 69,
  "types": ["grass", "poison"],
  "habitat": "grassland",
  "flavorTexts": [
    "A strange seed was planted on its back at birth...",
    "It can go for days without eating a single morsel..."
  ],
  "allMoveNames": ["Tackle", "Vine Whip", "Razor Leaf", ...],
  "imagePng": "/pokemon/1.png",
  "imageSvg": "/pokemon/1.svg",
  "region": "Kanto"
}
```

#### Cache Pokemon Data

Manually cache Pokemon data (downloads sprites).

```http
POST /api/pokemon/{id}
```

**Response:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "cached": true
}
```

### Summaries

Manage generated field log summaries.

#### Get All Summaries

Retrieve all summaries, optionally filtered by generation.

```http
GET /api/summaries?generationId={number}
```

**Query Parameters:**
- `generationId` (optional) - Filter by generation (1-9)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Bulbasaur",
    "summary": "Pokemon trainer log 1. Emerald blades of tall grass...",
    "region": "Kanto",
    "generationId": 1,
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  },
  ...
]
```

#### Get Summary

Retrieve a specific summary by Pokemon ID.

```http
GET /api/summaries/{id}
```

**Response:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "summary": "Pokemon trainer log 1. Emerald blades of tall grass...",
  "region": "Kanto",
  "generationId": 1,
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Create or Update Summary

Save a new summary or update an existing one.

```http
POST /api/summaries
```

**Request Body:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "summary": "Pokemon trainer log 1. Emerald blades of tall grass...",
  "region": "Kanto",
  "generationId": 1
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "summary": "Pokemon trainer log 1. Emerald blades of tall grass...",
  "region": "Kanto",
  "generationId": 1,
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Delete Summary

Delete a summary by Pokemon ID.

```http
DELETE /api/summaries/{id}
```

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

### Audio Logs

Manage generated audio narrations.

#### Get All Audio Logs

Retrieve all audio logs, optionally filtered by generation.

```http
GET /api/audio?generationId={number}
```

**Query Parameters:**
- `generationId` (optional) - Filter by generation (1-9)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Bulbasaur",
    "region": "Kanto",
    "generationId": 1,
    "voice": "Kore",
    "audioBase64": "base64-encoded-audio-data...",
    "audioFormat": "wav",
    "sampleRate": 24000,
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  },
  ...
]
```

#### Get Audio Log

Retrieve a specific audio log by Pokemon ID.

```http
GET /api/audio/{id}
```

**Response:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "region": "Kanto",
  "generationId": 1,
  "voice": "Kore",
  "audioBase64": "base64-encoded-audio-data...",
  "audioFormat": "wav",
  "sampleRate": 24000,
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Create or Update Audio Log

Save a new audio log or update an existing one.

```http
POST /api/audio
```

**Request Body:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "region": "Kanto",
  "generationId": 1,
  "voice": "Kore",
  "audioBase64": "base64-encoded-audio-data...",
  "audioFormat": "wav",
  "sampleRate": 24000
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Bulbasaur",
  "region": "Kanto",
  "generationId": 1,
  "voice": "Kore",
  "audioBase64": "base64-encoded-audio-data...",
  "audioFormat": "wav",
  "sampleRate": 24000,
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Delete Audio Log

Delete an audio log by Pokemon ID.

```http
DELETE /api/audio/{id}
```

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

### Prompts

Manage custom prompt overrides for AI generation.

#### Get All Prompts

Retrieve all stored prompts.

```http
GET /api/prompts
```

**Response:**
```json
{
  "summary": {
    "type": "summary",
    "content": "Custom summary prompt...",
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  },
  "tts": {
    "type": "tts",
    "content": "Custom TTS prompt...",
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

#### Get Specific Prompt

Retrieve a specific prompt by type.

```http
GET /api/prompts/{type}
```

**Parameters:**
- `type` - "summary" or "tts"

**Response:**
```json
{
  "type": "summary",
  "content": "Custom summary prompt...",
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Save or Update Prompt

Save a new prompt or update an existing one.

```http
POST /api/prompts
```

**Request Body:**
```json
{
  "type": "summary" | "tts",
  "content": "Custom prompt content..."
}
```

**Response:**
```json
{
  "type": "summary",
  "content": "Custom prompt content...",
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

#### Delete Prompt

Delete a prompt by type (reverts to default).

```http
DELETE /api/prompts?type={type}
```

**Query Parameters:**
- `type` - "summary" or "tts"

**Response:**
```json
{
  "success": true,
  "type": "summary"
}
```

## Data Types

### Job Status

```typescript
type JobStatus = 
  | "queued"      // Waiting to be processed
  | "running"     // Currently processing
  | "paused"      // Paused by user
  | "completed"   // Successfully completed
  | "failed"      // Failed with error
  | "canceled";   // Canceled by user
```

### Job Stage

```typescript
type JobStage = 
  | "summary"     // Generating text summaries
  | "audio";      // Generating audio narration
```

### Job Mode

```typescript
type JobMode = 
  | "FULL"            // Generate summaries and audio
  | "SUMMARY_ONLY"    // Generate summaries only
  | "AUDIO_ONLY";     // Generate audio from existing summaries
```

### Voice Profile

```typescript
type VoiceProfile = 
  | "Kore"      // Sophisticated female voice
  | "Zephyr"    // Professional female voice
  | "Charon"    // Resonant male voice
  | "Puck"      // Youthful male voice
  | "Fenrir";   // Rugged male voice
```

### Generation Regions

```typescript
const GENERATION_REGIONS: Record<number, string> = {
  1: "Kanto",
  2: "Johto",
  3: "Hoenn",
  4: "Sinnoh",
  5: "Unova",
  6: "Kalos",
  7: "Alola",
  8: "Galar",
  9: "Paldea"
};
```

## Rate Limits

The application enforces server-side rate limits to comply with Gemini API restrictions:

- **Summary Generation:** 15-second cooldown between each Pokemon
- **TTS Generation:** 5-minute cooldown between batches (up to 15 summaries per batch)

Cooldown information is included in job status responses via the `cooldownUntil` field.

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource does not exist |
| 500 | Internal Server Error - Server-side error |

## Authentication

Currently, the application does not require authentication. All endpoints are accessible without credentials. The Gemini API key is stored server-side and never exposed to clients.

## CORS

The API is designed for same-origin requests only. Cross-origin requests are not supported in the default configuration.

## Versioning

The API does not currently use versioning. Breaking changes will be documented in release notes.
