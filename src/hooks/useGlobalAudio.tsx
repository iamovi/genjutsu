import React, { createContext, useContext, useState, useCallback, useRef } from "react";

type AudioSource = "music-player" | "profile-song" | "other";

interface GlobalAudioContextType {
  activeSource: AudioSource | null;
  requestPlay: (source: AudioSource, onStop: () => void) => boolean;
  notifyStop: (source: AudioSource) => void;
}

const GlobalAudioContext = createContext<GlobalAudioContextType | undefined>(undefined);

export const GlobalAudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeSource, setActiveSource] = useState<AudioSource | null>(null);
  const stopCallbackRef = useRef<(() => void) | null>(null);

  const requestPlay = useCallback((source: AudioSource, onStop: () => void) => {
    // If something else is playing, stop it
    if (activeSource && activeSource !== source && stopCallbackRef.current) {
      stopCallbackRef.current();
    }

    setActiveSource(source);
    stopCallbackRef.current = onStop;
    return true;
  }, [activeSource]);

  const notifyStop = useCallback((source: AudioSource) => {
    if (activeSource === source) {
      setActiveSource(null);
      stopCallbackRef.current = null;
    }
  }, [activeSource]);

  return (
    <GlobalAudioContext.Provider value={{ activeSource, requestPlay, notifyStop }}>
      {children}
    </GlobalAudioContext.Provider>
  );
};

export const useGlobalAudio = () => {
  const context = useContext(GlobalAudioContext);
  if (!context) {
    throw new Error("useGlobalAudio must be used within a GlobalAudioProvider");
  }
  return context;
};
