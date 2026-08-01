/**
 * Сопоставление строки поиска с данными — одно на все списки.
 *
 * Наивный `name.toLowerCase().includes(q)` подводил на реальном вводе:
 *  - «Петр» не находил «Пётр» (люди почти никогда не печатают ё);
 *  - «996555111222» и «0555111222» не находили телефон «+996 555 111 222»,
 *    потому что сравнивалась строка вместе с пробелами и плюсом;
 *  - «№170» не находил бронь 170.
 */

/** Регистр и ё→е: «Петр», «ПЁТР» и «пётр» — одно и то же. */
export function normText(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

/**
 * Только цифры номера. Ведущий 0 местного формата отбрасываем:
 * 0555 111 222 — это тот же номер, что +996 555 111 222.
 */
export function phoneDigits(s: string): string {
  const d = s.replace(/\D/g, "");
  return d.startsWith("0") ? d.slice(1) : d;
}

/** Совпадение по имени/названию. */
export function matchText(haystack: string, q: string): boolean {
  return normText(haystack).includes(normText(q));
}

/** Совпадение по телефону в любом формате записи. */
export function matchPhone(phone: string, q: string): boolean {
  const digits = phoneDigits(q);
  return digits.length > 0 && phoneDigits(phone).includes(digits);
}

/** Совпадение по номеру: «170», «№170», «# 170». */
export function matchNumber(id: number, q: string): boolean {
  const digits = q.replace(/\D/g, "");
  return digits.length > 0 && String(id).includes(digits);
}
