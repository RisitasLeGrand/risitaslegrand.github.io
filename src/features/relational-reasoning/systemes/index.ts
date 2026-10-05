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
import { digraph } from './digraph';
import { poset, posetOuvert } from './poset';
import { space } from './space';
import { cyclic } from './cyclic';
import { allen } from './allen';
import { rcc8 } from './rcc8';
import { grandeur } from './grandeur';
import { planTemps } from './plan-temps';
import { rang } from './rang';
import { anneau } from './anneau';

export const SYSTEMES: Systeme[] = [
  line,
  grandeur,
  rang,
  anneau,
  plane,
  planTemps,
  groups,
  digraph,
  poset,
  posetOuvert,
  space,
  cyclic,
  rcc8,
  allen,
];

export function systemeParId(id: string): Systeme | undefined {
  return SYSTEMES.find((systeme) => systeme.id === id);
}

export type { Systeme };
