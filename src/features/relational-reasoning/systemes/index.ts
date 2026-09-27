/**
 * Catalogue des systèmes.
 *
 * Les moteurs n'importent jamais un système par son nom : ils reçoivent celui
 * que la session a choisi. Ce fichier est le seul endroit où la liste existe.
 */
import type { Systeme } from './types';
import { groups } from './groups';
import { line } from './line';
import { plane } from './plane';

export const SYSTEMES: Systeme[] = [line, plane, groups];

export function systemeParId(id: string): Systeme | undefined {
  return SYSTEMES.find((systeme) => systeme.id === id);
}

export type { Systeme };
