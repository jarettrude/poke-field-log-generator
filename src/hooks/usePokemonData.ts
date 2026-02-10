/**
 * Custom hook for managing Pokemon data and generation/variant selection.
 * Handles fetching generations, Pokemon lists, and variant categories with caching.
 */

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

  const [collectionType, setCollectionType] = useState<CollectionType>('generation');
  const [selectedVariantCategories, setSelectedVariantCategories] = useState<VariantCategory[]>([
    'mega',
    'regional',
    'gmax',
  ]);

  const initialLoadRef = useRef(false);

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

  const fetchVariantsForCurrentGen = useCallback(
    async (genId: number, categories: VariantCategory[]) => {
      if (categories.length === 0) {
        setPokemonList([]);
        return;
      }

      setIsLoading(true);
      try {
        const variants = await fetchVariantsByCategory(categories, genId);
        setPokemonList(variants);

        const genInfo = await fetchGenerationWithRegion(genId);
        setCurrentRegion(`${genInfo.region} Variants`);

        if (variants.length > 0) {
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

  const handleGenChange = useCallback(
    async (genId: number) => {
      setSelectedGenId(genId);
      setIsLoading(true);

      try {
        if (collectionType === 'generation') {
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
          await fetchVariantsForCurrentGen(genId, selectedVariantCategories);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [collectionType, selectedVariantCategories, fetchVariantsForCurrentGen]
  );

  const handleVariantCategoryChange = useCallback(
    async (categories: VariantCategory[]) => {
      setSelectedVariantCategories(categories);
      await fetchVariantsForCurrentGen(selectedGenId, categories);
    },
    [selectedGenId, fetchVariantsForCurrentGen]
  );

  const handleCollectionTypeChange = useCallback(
    async (type: CollectionType) => {
      setCollectionType(type);

      if (type === 'generation') {
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
        await fetchVariantsForCurrentGen(selectedGenId, selectedVariantCategories);
      }
    },
    [selectedGenId, selectedVariantCategories, fetchVariantsForCurrentGen]
  );

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

    collectionType,
    selectedVariantCategories,
    handleCollectionTypeChange,
    toggleVariantCategory,
    handleVariantCategoryChange,
  };
}
