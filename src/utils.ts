export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pick<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): Partial<T> {
  return keys.reduce((acc, key) => {
    if (key in obj) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Partial<T>);
}
