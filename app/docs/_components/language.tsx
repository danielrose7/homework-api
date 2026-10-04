"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { Language } from "@/app/docs/_lib/snippets";

const LanguageContext = createContext<
  [Language, Dispatch<SetStateAction<Language>>] | null
>(null);

/** Keeps the chosen language the same across every example on the page. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const state = useState<Language>("curl");
  return (
    <LanguageContext.Provider value={state}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const state = useContext(LanguageContext);
  if (!state) throw new Error("useLanguage needs a LanguageProvider");
  return state;
}
