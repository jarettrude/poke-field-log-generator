import { useState, useEffect } from 'react';
import {
  fetchGenerations,
  fetchPokemonInGeneration,
  fetchGenerationWithRegion,
} from '@/services/pokeService';
import { Generation, PokemonBaseInfo } from '@/types';

export function usePokemonData() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selectedGenId, setSelectedGenId] = useState<number>(1);
  const [currentRegion, setCurrentRegion] = useState<string>('Kanto');
  const [pokemonList, setPokemonList] = useState<PokemonBaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(151);

  // Initialize generations
  useEffect(() => {
    const init = async () => {
      const gens = await fetchGenerations();
      setGenerations(gens);
      if (gens.length > 0 && gens[0]?.id) {
        handleGenChange(gens[0].id);
      }
    };
    init();
  }, []);

  const handleGenChange = async (genId: number) => {
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
  };

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
  };
}
