# Pokemon Variant Support Implementation Plan

## Overview

Add comprehensive support for Pokemon variants (Mega Evolutions, Regional Forms, Gigantamax, etc.) while maintaining full backward compatibility with the existing generation-based system. The implementation will be fully dynamic, relying on PokeAPI data to automatically support new variants as they're added.

## Design Principles

1. **Dynamic Discovery** - All variant data comes from PokeAPI; no hardcoded lists
2. **Unified ID System** - Use PokeAPI's unique IDs (e.g., 10107 for Alolan Meowth)
3. **Backward Compatible** - Existing generation browsing continues to work unchanged
4. **Progressive Enhancement** - Variants are an optional addition, not a replacement
5. **Cache-Friendly** - Variants use the same caching strategy as base Pokemon

---

## Architecture Changes

### Key Insight: PokeAPI's Natural ID System

PokeAPI already assigns unique numeric IDs to each variant:

- Base Meowth: `52`
- Alolan Meowth: `10107`
- Galarian Meowth: `10161`
- Gigantamax Meowth: `10200`

This means we DON'T need to change our ID system - we just need to:

1. Discover these variant IDs dynamically
2. Treat them as first-class Pokemon entries
3. Add metadata to track variant relationships

---

## Layer-by-Layer Implementation

### 1. Types & Interfaces (`src/types.ts`)

```typescript
// New types to add

/**
 * Variant category for filtering UI.
 * These are derived dynamically from PokeAPI data:
 * - 'mega' detected via is_mega flag
 * - 'regional' detected by matching form_name against /region endpoint
 * - 'gmax' detected by form_name === 'gmax' (PokeAPI convention)
 * - 'other' is the fallback for unrecognized forms
 */
export type VariantCategory =
  | 'default' // Base forms (normal generation Pokemon)
  | 'mega' // Mega Evolutions (is_mega: true)
  | 'regional' // Regional forms (form matches a region name)
  | 'gmax' // Gigantamax (form_name: 'gmax')
  | 'other'; // Totems, special forms, etc.

/** Extended Pokemon base info with variant metadata */
export interface PokemonBaseInfo {
  id: number; // PokeAPI unique ID (e.g., 10107)
  name: string; // Full API name (e.g., "meowth-alola")
  displayName: string; // Formatted name (e.g., "Alolan Meowth")
  url: string;
  speciesId: number; // National dex number (e.g., 52)
  isDefault: boolean; // true for base forms
  formName: string | null; // Form identifier (e.g., "alola", "mega-x")
  variantCategory: VariantCategory;
  regionName?: string; // For regional forms, the region (e.g., "Alola")
}

/** Pokemon details with variant info */
export interface PokemonDetails {
  // ... existing fields ...
  speciesId: number; // National dex ID
  isDefault: boolean;
  formName: string | null;
  displayName: string; // Formatted display name
  variantCategory: VariantCategory;
  regionName?: string; // For regional forms
}

/** Collection filter for the generator UI */
export interface CollectionFilter {
  type: 'generation' | 'variants';
  generationId?: number; // For generation mode
  variantCategories?: VariantCategory[]; // For variant mode
  regionName?: string; // Optional regional filter for variants
}
```

### 2. Database Schema Updates (`src/lib/db/sqlite.ts`)

```sql
-- Migration: Add variant columns to pokemon_cache
ALTER TABLE pokemon_cache ADD COLUMN species_id INTEGER;
ALTER TABLE pokemon_cache ADD COLUMN is_default INTEGER DEFAULT 1;
ALTER TABLE pokemon_cache ADD COLUMN form_name TEXT;
ALTER TABLE pokemon_cache ADD COLUMN display_name TEXT;
ALTER TABLE pokemon_cache ADD COLUMN variant_category TEXT DEFAULT 'default';

-- Create index for variant queries
CREATE INDEX IF NOT EXISTS idx_pokemon_variant_category
  ON pokemon_cache(variant_category);
CREATE INDEX IF NOT EXISTS idx_pokemon_species_id
  ON pokemon_cache(species_id);

-- Summaries and audio already use pokemon ID as key, no changes needed
-- since variant IDs are unique (10107, not 52-alola)
```

### 3. PokeService Updates (`src/services/pokeService.ts`)

New functions with **fully dynamic** category detection:

```typescript
// Cache for region names fetched from PokeAPI
let cachedRegionNames: string[] | null = null;

/**
 * Fetch all region names from PokeAPI dynamically.
 * Used to detect regional forms without hardcoding region names.
 */
async function getRegionNames(): Promise<string[]> {
  if (cachedRegionNames) return cachedRegionNames;

  const res = await fetch(`${BASE_URL}/region`);
  if (!res.ok) {
    // Fallback - but shouldn't happen
    console.warn('Failed to fetch regions, using empty list');
    return [];
  }

  const data = await res.json();
  cachedRegionNames = data.results.map((r: { name: string }) => r.name);
  return cachedRegionNames;
}

/**
 * Categorize a Pokemon form DYNAMICALLY using PokeAPI data.
 *
 * Detection logic:
 * 1. is_mega flag from /pokemon-form/ endpoint → 'mega'
 * 2. form_name matches a region from /region endpoint → 'regional'
 * 3. form_name === 'gmax' → 'gmax' (PokeAPI naming convention)
 * 4. Everything else → 'other'
 */
async function categorizeVariant(
  formName: string | null,
  isMega: boolean
): Promise<{ category: VariantCategory; regionName?: string }> {
  if (!formName) return { category: 'default' };

  // Check for Mega (using API flag)
  if (isMega) return { category: 'mega' };

  // Check for Gigantamax (PokeAPI naming convention)
  if (formName === 'gmax') return { category: 'gmax' };

  // Check for regional forms by matching against dynamic region list
  const regions = await getRegionNames();
  for (const region of regions) {
    if (formName.includes(region)) {
      // Capitalize region name for display
      const regionName = region.charAt(0).toUpperCase() + region.slice(1);
      return { category: 'regional', regionName };
    }
  }

  // Fallback for other forms (Totem, Primal, Origin, etc.)
  return { category: 'other' };
}

/**
 * Format a variant name for display.
 * Dynamically constructs display name based on variant category.
 */
function formatDisplayName(
  name: string,
  formName: string | null,
  category: VariantCategory,
  regionName?: string
): string {
  const baseName = name.split('-')[0];
  const capitalizedBase = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  if (!formName || category === 'default') return capitalizedBase;

  // Regional forms: Use dynamically detected region name
  if (category === 'regional' && regionName) {
    // "Alola" → "Alolan", "Galar" → "Galarian", etc.
    const adjective = regionName.endsWith('a')
      ? regionName.slice(0, -1) + 'n' // Alola → Alolan
      : regionName + 'ian'; // Hisui → Hisuian (close enough)
    return `${adjective} ${capitalizedBase}`;
  }

  // Mega evolutions: "Mega Charizard X"
  if (category === 'mega') {
    const suffix = formName.replace('mega', '').replace(/-/g, ' ').trim().toUpperCase();
    return `Mega ${capitalizedBase}${suffix ? ' ' + suffix : ''}`;
  }

  // Gigantamax: "Gigantamax Charizard"
  if (category === 'gmax') return `Gigantamax ${capitalizedBase}`;

  // Other forms: "Rotom (Heat)", "Lycanroc (Midnight)"
  const formSuffix = formName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return `${capitalizedBase} (${formSuffix})`;
}

/**
 * Fetch all variants for Pokemon in a generation.
 * Returns variants EXCLUDING default forms (those are in fetchPokemonInGeneration).
 */
export async function fetchVariantsForGeneration(genId: number): Promise<PokemonBaseInfo[]> {
  const basePokemon = await fetchPokemonInGeneration(genId);
  const variants: PokemonBaseInfo[] = [];

  for (const pokemon of basePokemon) {
    const speciesRes = await fetch(`${BASE_URL}/pokemon-species/${pokemon.id}`);
    if (!speciesRes.ok) continue;

    const speciesData = await speciesRes.json();

    for (const variety of speciesData.varieties) {
      if (variety.is_default) continue; // Skip base forms

      const variantId = parseInt(variety.pokemon.url.split('/').filter(Boolean).pop()!);
      const variantName = variety.pokemon.name;
      const formName = variantName.replace(`${speciesData.name}-`, '') || null;

      // Fetch form data for is_mega flag
      const formRes = await fetch(`${BASE_URL}/pokemon-form/${variantName}`);
      const formData = formRes.ok ? await formRes.json() : { is_mega: false };

      const category = categorizeVariant(formName, formData.is_mega);

      variants.push({
        id: variantId,
        name: variantName,
        displayName: formatDisplayName(variantName, formName),
        url: variety.pokemon.url,
        speciesId: pokemon.id,
        isDefault: false,
        formName,
        variantCategory: category,
      });
    }
  }

  return variants.sort((a, b) => a.speciesId - b.speciesId);
}

/**
 * Fetch all variants across all generations, organized by category.
 * Used for the "Variants" collection mode.
 */
export async function fetchAllVariants(): Promise<{
  mega: PokemonBaseInfo[];
  regional: PokemonBaseInfo[];
  gmax: PokemonBaseInfo[];
  other: PokemonBaseInfo[];
}> {
  const generations = await fetchGenerations();
  const allVariants: PokemonBaseInfo[] = [];

  for (const gen of generations) {
    const variants = await fetchVariantsForGeneration(gen.id);
    allVariants.push(...variants);
  }

  return {
    mega: allVariants.filter(v => v.variantCategory === 'mega'),
    regional: allVariants.filter(v => v.variantCategory === 'regional'),
    gmax: allVariants.filter(v => v.variantCategory === 'gmax'),
    other: allVariants.filter(v => v.variantCategory === 'other'),
  };
}

/**
 * Fetch variants by category (for filtered views).
 */
export async function fetchVariantsByCategory(
  category: VariantCategory
): Promise<PokemonBaseInfo[]> {
  const all = await fetchAllVariants();
  return all[category as keyof typeof all] || [];
}
```

### 4. Server Pokemon Module Updates (`src/lib/server/pokemon.ts`)

Update `getOrFetchPokemonDetailsServer` to handle variants:

```typescript
export async function getOrFetchPokemonDetailsServer(id: number): Promise<PokemonDetails> {
  // ... existing cache check ...

  // When fetching from PokeAPI, also get form data
  const pokemonRes = await fetch(`${BASE_URL}/pokemon/${id}`);
  const pokemonData = await pokemonRes.json();

  // Determine if this is a variant
  const speciesRes = await fetch(pokemonData.species.url);
  const speciesData = await speciesRes.json();
  const speciesId = speciesData.id;

  // Check if this is the default variety
  const isDefault =
    speciesData.varieties.find(
      (v: any) => parseInt(v.pokemon.url.split('/').filter(Boolean).pop()) === id
    )?.is_default ?? true;

  // Extract form name if variant
  const formName = isDefault ? null : pokemonData.name.replace(`${speciesData.name}-`, '');

  // Get form metadata for is_mega
  let isMega = false;
  if (!isDefault) {
    const formRes = await fetch(`${BASE_URL}/pokemon-form/${pokemonData.name}`);
    if (formRes.ok) {
      const formData = await formRes.json();
      isMega = formData.is_mega;
    }
  }

  const variantCategory = categorizeVariant(formName, isMega);
  const displayName = formatDisplayName(pokemonData.name, formName);

  // ... rest of existing logic, but include new fields in cache and return ...
}
```

### 5. UI Components

#### 5a. GenerationView (`src/components/GenerationView.tsx`)

Add a "Collection Type" selector at the top:

```tsx
// New state
const [collectionType, setCollectionType] = useState<'generation' | 'variants'>('generation');
const [selectedVariantCategories, setSelectedVariantCategories] = useState<VariantCategory[]>([]);

// UI addition at top of form
<div className="mb-6">
  <label className="label">COLLECTION TYPE</label>
  <div className="flex gap-3">
    <button
      onClick={() => setCollectionType('generation')}
      className={collectionType === 'generation' ? 'btn btn-primary' : 'btn btn-outline'}
    >
      <Layers className="h-4 w-4" />
      Generations
    </button>
    <button
      onClick={() => setCollectionType('variants')}
      className={collectionType === 'variants' ? 'btn btn-primary' : 'btn btn-outline'}
    >
      <Sparkles className="h-4 w-4" />
      Variant Forms
    </button>
  </div>
</div>;

{
  /* Show variant category checkboxes when in variant mode */
}
{
  collectionType === 'variants' && (
    <div className="mb-6">
      <label className="label">VARIANT TYPES</label>
      <div className="flex flex-wrap gap-2">
        {variantCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => toggleCategory(cat.id)}
            className={
              selectedCategories.includes(cat.id)
                ? 'btn btn-sm btn-primary'
                : 'btn btn-sm btn-outline'
            }
          >
            {cat.icon} {cat.label} ({cat.count})
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 5b. Pokemon Card Component

Show variant badges on cards:

```tsx
// In the Pokemon card rendering
{
  !pokemon.isDefault && (
    <span className="badge badge-variant">
      {pokemon.variantCategory === 'mega' && '⚡ Mega'}
      {pokemon.variantCategory === 'regional' && `🌍 ${pokemon.formName}`}
      {pokemon.variantCategory === 'gmax' && '🔮 Gmax'}
    </span>
  );
}
```

#### 5c. ProcessingOverlay & ResultsView

Use `displayName` instead of `name`:

```tsx
// ProcessingOverlay - already shows Pokemon name
<div className="text-lg font-bold">
  #{formatPokemonId(progress.currentPokemonId)} {pokemon.displayName}
</div>

// ResultsView - use displayName
<h3 className="font-bold capitalize">{r.displayName || r.name}</h3>
```

### 6. Hooks Updates

#### 6a. usePokemonData (`src/hooks/usePokemonData.ts`)

```typescript
// Add variant fetching capability
const fetchPokemonList = useCallback(async (filter: CollectionFilter) => {
  if (filter.type === 'generation') {
    // Existing logic
    return await fetchPokemonInGeneration(filter.generationId!);
  } else {
    // New variant mode
    const all = await fetchAllVariants();
    let filtered: PokemonBaseInfo[] = [];

    for (const cat of filter.variantCategories || []) {
      filtered.push(...(all[cat as keyof typeof all] || []));
    }

    return filtered.sort((a, b) => a.speciesId - b.speciesId);
  }
}, []);
```

### 7. Job System Updates

#### 7a. Jobs Table (already uses numeric IDs - no change needed!)

Since variant Pokemon have unique numeric IDs (10107, 10161, etc.), the existing `pokemonIds INTEGER[]` column works perfectly!

```typescript
// Job creation already works:
const job = await db.createJob({
  pokemonIds: [10107, 10161, 10200], // Variant IDs work natively
  mode: 'FULL',
  // ...
});
```

### 8. Library/Pokedex View Updates

Add variant filtering to the library view:

```tsx
// Filter controls
<div className="mb-4 flex gap-2">
  <button onClick={() => setFilter('all')} className={filter === 'all' ? 'btn-active' : ''}>
    All
  </button>
  <button onClick={() => setFilter('default')} className={filter === 'default' ? 'btn-active' : ''}>
    Base Forms
  </button>
  <button
    onClick={() => setFilter('variants')}
    className={filter === 'variants' ? 'btn-active' : ''}
  >
    Variants Only
  </button>
</div>
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
├─────────────────────────────────────────────────────────────────┤
│  GenerationView                                                  │
│  ┌──────────────┐    ┌──────────────┐                          │
│  │ Generations  │ OR │  Variants    │                          │
│  │  (Gen I-IX)  │    │ (Mega/Reg/G) │                          │
│  └──────────────┘    └──────────────┘                          │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  fetchPokemonIn      fetchVariantsByCategory()                  │
│  Generation()        (Dynamically from PokeAPI)                 │
│         │                   │                                    │
│         └────────┬──────────┘                                    │
│                  ▼                                               │
│        PokemonBaseInfo[]  (unified format)                      │
│        - id: 52 (base) or 10107 (variant)                       │
│        - displayName: "Meowth" or "Alolan Meowth"               │
│        - variantCategory: 'default' | 'regional' | etc.         │
│                  │                                               │
├─────────────────────────────────────────────────────────────────┤
│                       JOB SYSTEM                                 │
│                  │                                               │
│        pokemonIds: [52, 10107, 10161]  ← All just numbers!      │
│                  │                                               │
│        For each ID:                                              │
│        - Fetch details from cache or PokeAPI                    │
│        - Generate summary (AI gets types, moves, etc.)          │
│        - Generate audio                                          │
│                  │                                               │
├─────────────────────────────────────────────────────────────────┤
│                      CACHE/DATABASE                              │
│                                                                  │
│  pokemon_cache:                                                  │
│  ┌────┬────────────────┬────────────┬─────────────────┐        │
│  │ id │ name           │ species_id │ variant_category │        │
│  ├────┼────────────────┼────────────┼─────────────────┤        │
│  │ 52 │ meowth         │ 52         │ default         │        │
│  │10107│ meowth-alola   │ 52         │ regional        │        │
│  │10161│ meowth-galar   │ 52         │ regional        │        │
│  └────┴────────────────┴────────────┴─────────────────┘        │
│                                                                  │
│  summaries: (existing, works as-is)                             │
│  ┌────┬────────────────────────────────────────────────┐        │
│  │ id │ summary                                         │        │
│  ├────┼────────────────────────────────────────────────┤        │
│  │ 52 │ "Meowth is a Normal-type..."                    │        │
│  │10107│ "Alolan Meowth is a Dark-type that adapted..." │        │
│  └────┴────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Data Foundation ✅ COMPLETE

- [x] Update `types.ts` with variant interfaces
- [x] Add database migration for new columns
- [x] Update database adapter with new methods
- [ ] Add unit tests for variant categorization

### Phase 2: API Layer ✅ COMPLETE

- [x] Add `categorizeVariant()` and `formatDisplayName()` utilities
- [x] Implement `fetchVariantsForGeneration()`
- [x] Implement `fetchVariantsByCategory()`
- [x] Update `getOrFetchPokemonDetailsServer()` for variants
- [x] Update `/api/pokemon/[id]` route

### Phase 3: Hooks & State ✅ COMPLETE

- [x] Update `usePokemonData` with collection filter support
- [x] Add variant category selection/toggling
- [ ] Add variant category counts fetching (deferred for performance)

### Phase 4: UI Components ✅ COMPLETE

- [x] Add collection type toggle to `GenerationView`
- [x] Add variant category selectors
- [x] Add variant badges to Pokemon cards
- [x] Updated search to include displayName
- [x] Empty state for variants mode
- [x] Update `ProcessingOverlay` to use `displayName`
- [x] Update `ResultsView` to use `displayName`

### Phase 5: Library/Pokedex ✅ COMPLETE

- [x] Add variant filtering to library view
- [x] Show variant badges in saved summaries
- [x] Group by species option

### Phase 6: Polish & Testing ✅ COMPLETE

- [x] End-to-end testing with real variant data
- [x] Loading states for variant fetching
- [x] Error handling for missing sprites
- [x] Performance optimization (batch fetching)

---

## Dynamic Discovery Benefits

Because we rely on PokeAPI data, the app automatically supports:

1. **New Generations** - When Gen 10+ releases, `fetchGenerations()` returns them
2. **New Regional Forms** - Detected by form name patterns
3. **New Mega Evolutions** - Detected by `is_mega` flag from PokeAPI
4. **New Gmax Forms** - Detected by `gmax` in form name
5. **Future Form Types** - Fall into "other" category, still work!

---

## Performance Considerations

1. **Variant Discovery is Expensive** - Fetching all variants requires calling `/pokemon-species/` for each Pokemon. We should:
   - Cache variant lists in the database
   - Fetch on-demand, not on page load
   - Add a "Refresh Variants" button for manual updates

2. **Batch Fetching** - When generating for variants, batch API calls

3. **Progressive Loading** - Show generation Pokemon immediately, load variants in background

---

## Files to Modify

| File                                    | Changes                    |
| --------------------------------------- | -------------------------- |
| `src/types.ts`                          | Add variant types          |
| `src/lib/db/sqlite.ts`                  | Add migration, new columns |
| `src/lib/db/adapter.ts`                 | Add variant query methods  |
| `src/services/pokeService.ts`           | Add variant fetching       |
| `src/lib/server/pokemon.ts`             | Add variant metadata       |
| `src/hooks/usePokemonData.ts`           | Support collection filter  |
| `src/components/GenerationView.tsx`     | Add collection type UI     |
| `src/components/ProcessingOverlay.tsx`  | Use displayName            |
| `src/components/ResultsView.tsx`        | Use displayName            |
| `src/components/PokedexLibraryView.tsx` | Add variant filters        |

---

## Ready to Implement?

This plan is designed to be implemented incrementally. Each phase builds on the previous and the app remains functional throughout. Want me to start with **Phase 1: Data Foundation**?
