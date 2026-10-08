export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** A random permutation of [0, 1, 2, 3], used to shuffle a question's 4 options. */
export function shuffleOptionIndices(): number[] {
  return shuffle([0, 1, 2, 3]);
}
