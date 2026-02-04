import { useState, useEffect, useCallback } from 'react';
import {
  getAllSummaries,
  getAllAudioLogs,
  StoredSummary,
  AudioLogMetadata,
} from '@/services/storageService';

export function useSavedData() {
  const [savedSummaries, setSavedSummaries] = useState<StoredSummary[]>([]);
  const [savedAudioLogs, setSavedAudioLogs] = useState<AudioLogMetadata[]>([]);

  const refreshData = useCallback(async () => {
    try {
      const [summaries, audioLogs] = await Promise.all([getAllSummaries(), getAllAudioLogs()]);
      setSavedSummaries(summaries);
      setSavedAudioLogs(audioLogs);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshData();
    };
    void init();
  }, [refreshData]);

  return {
    savedSummaries,
    savedAudioLogs,
    refreshData,
    setSavedSummaries,
    setSavedAudioLogs,
  };
}
