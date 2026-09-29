import { TOTAL_WORDS } from './data';

export const BLOCK_SIZE = 50;
export const BLOCK_COUNT = 56;

/** Номер блоку 1–56 для рангу. Останній блок має 51 слово. */
export function blockOf(rank: number): number {
  return Math.min(Math.ceil(rank / BLOCK_SIZE), BLOCK_COUNT);
}

/** Ранги слів блоку. */
export function blockRanks(block: number): number[] {
  const start = (block - 1) * BLOCK_SIZE + 1;
  const end = block === BLOCK_COUNT ? TOTAL_WORDS : block * BLOCK_SIZE;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
