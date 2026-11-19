// The type markers every define* helper shares. Part of core/define.ts (import from there).

declare const paramsType: unique symbol
declare const resultType: unique symbol

/** Type-only marker. Never present at runtime. */
export interface Typed<P, R = void> {
  readonly [paramsType]: P
  readonly [resultType]: R
}

export type ParamsOf<D> = D extends { readonly [paramsType]: infer P } ? P : void
export type ResultOf<D> = D extends { readonly [resultType]: infer R } ? R : void

/**
 * Arguments after the id: none when an entry takes no params, otherwise the params object
 * (optional when its type allows undefined: `defineWindow<{ tab?: string } | undefined>`).
 */
export type ParamArgs<P> = [P] extends [void]
  ? [params?: undefined]
  : undefined extends P
    ? [params?: P]
    : [params: P]
