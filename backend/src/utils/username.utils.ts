/**
 * ====================================================
 * BÚSQUEDA DE USUARIOS INSENSIBLE A MAYÚSCULAS
 * ====================================================
 * El nombre de usuario se guarda con la capitalización que escribió la persona
 * ("Admin"), pero el login y la unicidad lo comparan sin distinguir mayúsculas:
 * "admin", "ADMIN" y "Admin" son el mismo usuario.
 *
 * Prisma con SQLite no soporta `mode: 'insensitive'` y su `equals` distingue
 * mayúsculas; `COLLATE NOCASE`/`lower()` de SQLite solo pliegan ASCII (no
 * distinguirían "Ñandú" de "ñandú"). Por eso se comparan los nombres en JavaScript
 * con `toLowerCase()`, sin SQL a mano. La tabla de usuarios de un POS es pequeña
 * (decenas de filas), así que leer id + username en cada login/alta es barato.
 */

import type { User } from '@prisma/client';
import prisma from '../prisma/client';

/** Forma canónica para comparar: sin espacios en los extremos, NFC y en minúsculas. */
export function normalizeUsername(username: string): string {
  return username.trim().normalize('NFC').toLowerCase();
}

/**
 * Busca un usuario por nombre sin distinguir mayúsculas (null si no existe).
 * Si hay datos antiguos con variantes ("admin" y "Admin"), prefiere la coincidencia exacta.
 * @param username Nombre de usuario a buscar
 * @param excludeId Id a ignorar (para validar la edición de un usuario sin chocar consigo mismo)
 */
export async function findUserByUsername(username: string, excludeId?: number): Promise<User | null> {
  const target = normalizeUsername(username);
  const candidates = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { id: 'asc' }
  });

  const matches = candidates.filter(
    (candidate) => candidate.id !== excludeId && normalizeUsername(candidate.username) === target
  );
  if (matches.length === 0) return null;

  const exact = matches.find((candidate) => candidate.username === username.trim());
  return prisma.user.findUnique({ where: { id: (exact ?? matches[0]).id } });
}
