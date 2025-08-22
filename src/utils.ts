/**
 * @example
 * ```ts
 * const counter = buildCounter(5);
 *
 * counter() // 6
 * counter() // 7
 * counter(2) // 9
 * ```
 */
export const buildCounter =
  (initial = 0, step = 1) =>
  (value = step) =>
    (initial += value);

export const cast = <T>(value: T): T => value;

export const wait = (ms: number) => {
  const context = {
    isCanceled: false,
    timeout: <NodeJS.Timeout | undefined>undefined,
  };

  const promise = new Promise<void>((resolve) =>
    context.isCanceled ? resolve() : (context.timeout = setTimeout(resolve, ms))
  );

  return Object.assign(promise, {
    value: ms,
    abort: () => {
      context.isCanceled = true;
      clearTimeout(context.timeout);
    },
  });
};
