import { databaseStorage } from "./database-service";
import type { StorageService } from "./service";

const services = new Map<string, StorageService>([
  [databaseStorage.name, databaseStorage],
]);

export const DEFAULT_STORAGE_SERVICE = databaseStorage.name;

export function storageService(name: string): StorageService {
  const service = services.get(name);
  if (!service) throw new Error(`No storage service named "${name}"`);
  return service;
}

export type { StorageService, StoredObject } from "./service";
