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
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
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
  "region": "Kanto" | "Johto" | ...,
  "voice": "Kore" | "Zephyr" | "Charon" | "Puck" | "Fenrir",
  "pokemonIds": number[]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string"
  }
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
  "success": true,
  "data": {
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
    "retryCount": 0,
    "pokemonIds": [1, 2, 3, ...],
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:05:00.000Z"
  }
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
  "success": true,
  "data": { "paused": true }
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
  "success": true,
  "data": { "resumed": true }
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
  "success": true,
  "data": { "canceled": true }
}
```

#### Maintenance: Pause All Jobs

Pause all currently running jobs.

```http
POST /api/jobs/maintenance/pause-all
```

**Response:**
```json
{
  "success": true,
  "data": { "pausedCount": 3 }
}
```

#### Maintenance: Cancel All Jobs

Cancel all currently running jobs.

```http
POST /api/jobs/maintenance/cancel-all
```

**Response:**
```json
{
  "success": true,
  "data": { "canceledCount": 3 }
}
```

#### Maintenance: Recover Stalled Jobs

Recover jobs stuck in running state beyond the stalled threshold (5 minutes).

```http
POST /api/jobs/maintenance/recover
```

**Response:**
```json
{
  "success": true,
  "data": { "recoveredCount": 1 }
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
  "success": true,
  "data": {
    "id": 1,
    "name": "bulbasaur",
    "displayName": "Bulbasaur",
    "height": 7,
    "weight": 69,
    "types": ["grass", "poison"],
    "habitat": "grassland",
    "flavorTexts": [
      "A strange seed was planted on its back at birth...",
      "It can go for days without eating a single morsel..."
    ],
    "moveNames": ["tackle", "vine-whip", "razor-leaf", ...],
    "imagePngPath": "/pokemon/1.png",
    "imageSvgPath": "/pokemon/1.svg",
    "generationId": 1,
    "region": "Kanto",
    "speciesId": 1,
    "isDefault": true,
    "formName": null,
    "variantCategory": "default",
    "regionName": null,
    "cachedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

Returns `{ "success": true, "data": null }` if not cached.

#### Cache Pokemon Data

Cache Pokemon data and download sprites.

```http
POST /api/pokemon/{id}
```

**Request Body:**
```json
{
  "id": 1,
  "name": "bulbasaur",
  "displayName": "Bulbasaur",
  "height": 7,
  "weight": 69,
  "types": ["grass", "poison"],
  "habitat": "grassland",
  "flavorTexts": ["..."],
  "moveNames": ["tackle", "vine-whip"],
  "imagePngUrl": "https://...",
  "imageSvgUrl": "https://...",
  "generationId": 1,
  "region": "Kanto",
  "speciesId": 1,
  "isDefault": true,
  "formName": null,
  "variantCategory": "default",
  "regionName": null
}
```

**Response:**
```json
{
  "success": true,
  "data": { "cached": true }
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
{
  "success": true,
  "data": [
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
}
```

#### Get Summary

Retrieve a specific summary by Pokemon ID.

```http
GET /api/summaries/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Bulbasaur",
    "summary": "Pokemon trainer log 1. Emerald blades of tall grass...",
    "region": "Kanto",
    "generationId": 1,
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
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
  "success": true,
  "data": { "saved": true }
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
  "data": { "deleted": true }
}
```

#### Bulk Delete Summaries

Delete multiple summaries by IDs.

```http
DELETE /api/summaries
```

**Request Body:**
```json
{
  "ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "data": { "deleted": 3 }
}
```

### Audio Logs

Manage generated audio narrations.

#### Get All Audio Logs (Metadata)

Retrieve metadata for all audio logs, optionally filtered by generation. The `audioBase64` field is excluded from list responses to prevent large payloads.

```http
GET /api/audio?generationId={number}
```

**Query Parameters:**
- `generationId` (optional) - Filter by generation (1-9)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Bulbasaur",
      "region": "Kanto",
      "generationId": 1,
      "voice": "Kore",
      "audioFormat": "mp3",
      "bitrate": 128,
      "createdAt": "2025-01-15T12:00:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    },
    ...
  ]
}
```

#### Get Audio Log

Retrieve a specific audio log by Pokemon ID (includes full audio data).

```http
GET /api/audio/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Bulbasaur",
    "region": "Kanto",
    "generationId": 1,
    "voice": "Kore",
    "audioBase64": "base64-encoded-mp3-data...",
    "audioFormat": "mp3",
    "bitrate": 128,
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
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
  "audioBase64": "base64-encoded-mp3-data...",
  "audioFormat": "mp3",
  "bitrate": 128
}
```

**Response:**
```json
{
  "success": true,
  "data": { "saved": true }
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
  "data": { "deleted": true }
}
```

#### Bulk Delete Audio Logs

Delete multiple audio logs by IDs.

```http
DELETE /api/audio
```

**Request Body:**
```json
{
  "ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "data": { "deleted": 3 }
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
  "success": true,
  "data": [
    {
      "type": "summary",
      "content": "Custom summary prompt...",
      "createdAt": "2025-01-15T12:00:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    },
    {
      "type": "tts",
      "content": "Custom TTS prompt...",
      "createdAt": "2025-01-15T12:00:00.000Z",
      "updatedAt": "2025-01-15T12:00:00.000Z"
    }
  ]
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
  "success": true,
  "data": {
    "type": "summary",
    "content": "Custom summary prompt...",
    "createdAt": "2025-01-15T12:00:00.000Z",
    "updatedAt": "2025-01-15T12:00:00.000Z"
  }
}
```

Returns `{ "success": true, "data": null }` if no override exists.

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
  "success": true,
  "data": { "saved": true }
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
  "data": { "deleted": true }
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

- **Summary Generation:** 15-second cooldown between each Pokemon (with ±20% jitter)
- **TTS Generation:** 15-second cooldown between each Pokemon (with ±20% jitter), one TTS call per Pokemon
- **Concurrency:** Up to 3 concurrent summary jobs, 1 concurrent audio job

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
