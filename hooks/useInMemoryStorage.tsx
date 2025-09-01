"use client";

import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { useMemo } from "react";

export function useInMemoryStorage() {
  const storage = useMemo(() => new GenericStringStorage(), []);
  
  return { storage };
}