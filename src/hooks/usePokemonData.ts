import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchGenerations,
  fetchPokemonInGeneration,
  fetchGenerationWithRegion,
  fetchVariantsByCategory,
} from '@/services/pokeService';
import { Generation, PokemonBaseInfo, CollectionType, VariantCategory } from '@/types';

export function usePokemonData() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedGenId, setSelectedGenId] = useState<number>(1);
  const [currentRegion, setCurrentRegion] = useState<string>('Kanto');
  const [pokemonList, setPokemonList] = useState<PokemonBaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(151);

  // Variant mode state
  const [collectionType, setCollectionType] = useState<CollectionType>('generation');
  const [selectedVariantCategories, setSelectedVariantCategories] = useState<VariantCategory[]>([
    'mega',
    'regional',
    'gmax',
  ]);

  // Track if initial load complete
  const initialLoadRef = useRef(false);

  // Initialize generations
  useEffect(() => {
    const init = async () => {
      const gens = await fetchGenerations();
      setGenerations(gens);
      if (gens.length > 0 && gens[0]?.id) {
        const genId = gens[0].id;
        setSelectedGenId(genId);
        setIsLoading(true);
        try {
          const [list, genInfo] = await Promise.all([
            fetchPokemonInGeneration(genId),
            fetchGenerationWithRegion(genId),
          ]);
          setPokemonList(list);
          setCurrentRegion(genInfo.region);

          if (list.length > 0) {
            const ids = list.map(p => p.id);
            setRangeStart(Math.min(...ids));
            setRangeEnd(Math.max(...ids));
          }
        } finally {
          setIsLoading(false);
        }
        initialLoadRef.current = true;
      }
    };
    init();
  }, []);

  // Fetch variants for the current generation and selected categories
  const fetchVariantsForCurrentGen = useCallback(
    async (genId: number, categories: VariantCategory[]) => {
      if (categories.length === 0) {
        setPokemonList([]);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch only variants for this generation (fast!)
        const variants = await fetchVariantsByCategory(categories, genId);
        setPokemonList(variants);

        // Get the region name for context
        const genInfo = await fetchGenerationWithRegion(genId);
        setCurrentRegion(`${genInfo.region} Variants`);

        if (variants.length > 0) {
          // For variants, use index-based range since IDs can be very large
          setRangeStart(0);
          setRangeEnd(variants.length - 1);
        } else {
          setRangeStart(0);
          setRangeEnd(0);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Handle generation change - works in both modes
  const handleGenChange = useCallback(
    async (genId: number) => {
      setSelectedGenId(genId);
      setIsLoading(true);

      try {
        if (collectionType === 'generation') {
          // Standard generation mode - fetch base Pokemon
          const [list, genInfo] = await Promise.all([
            fetchPokemonInGeneration(genId),
            fetchGenerationWithRegion(genId),
          ]);
          setPokemonList(list);
          setCurrentRegion(genInfo.region);

          if (list.length > 0) {
            const ids = list.map(p => p.id);
            setRangeStart(Math.min(...ids));
            setRangeEnd(Math.max(...ids));
          }
        } else {
          // Variant mode - fetch variants for this generation
          await fetchVariantsForCurrentGen(genId, selectedVariantCategories);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [collectionType, selectedVariantCategories, fetchVariantsForCurrentGen]
  );

  // Handle variant category change - refetch variants for current generation
  const handleVariantCategoryChange = useCallback(
    async (categories: VariantCategory[]) => {
      setSelectedVariantCategories(categories);
      await fetchVariantsForCurrentGen(selectedGenId, categories);
    },
    [selectedGenId, fetchVariantsForCurrentGen]
  );

  // Switch between generation and variant modes
  const handleCollectionTypeChange = useCallback(
    async (type: CollectionType) => {
      setCollectionType(type);

      if (type === 'generation') {
        // Switch to generation mode - reload base Pokemon
        setIsLoading(true);
        try {
          const [list, genInfo] = await Promise.all([
            fetchPokemonInGeneration(selectedGenId),
            fetchGenerationWithRegion(selectedGenId),
          ]);
          setPokemonList(list);
          setCurrentRegion(genInfo.region);

          if (list.length > 0) {
            const ids = list.map(p => p.id);
            setRangeStart(Math.min(...ids));
            setRangeEnd(Math.max(...ids));
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        // Switch to variant mode - load variants for current generation
        await fetchVariantsForCurrentGen(selectedGenId, selectedVariantCategories);
      }
    },
    [selectedGenId, selectedVariantCategories, fetchVariantsForCurrentGen]
  );

  // Toggle a variant category
  const toggleVariantCategory = useCallback(
    (category: VariantCategory) => {
      const newCategories = selectedVariantCategories.includes(category)
        ? selectedVariantCategories.filter(c => c !== category)
        : [...selectedVariantCategories, category];
      handleVariantCategoryChange(newCategories);
    },
    [selectedVariantCategories, handleVariantCategoryChange]
  );

  return {
    // Generation mode
    generations,
    selectedGenId,
    currentRegion,
    pokemonList,
    isLoading,
    rangeStart,
    rangeEnd,
    setRangeStart,
    setRangeEnd,
    handleGenChange,

    // Variant mode
    collectionType,
    selectedVariantCategories,
    handleCollectionTypeChange,
    toggleVariantCategory,
    handleVariantCategoryChange,
  };
}
