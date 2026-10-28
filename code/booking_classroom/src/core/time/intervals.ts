/** Returns whether two time ranges on the same calendar day overlap. */
export function sameDayPeriodsOverlap(
  firstDate: string,
  firstStart: string,
  firstEnd: string,
  secondDate: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return firstDate === secondDate && firstStart < secondEnd && firstEnd > secondStart;
}
