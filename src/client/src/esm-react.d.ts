declare module "https://esm.sh/react@18" {
  export type RefObject<T> = {
    current: T | null;
  };

  export function createElement(type: unknown, props?: unknown, ...children: unknown[]): unknown;
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function useState<T>(initialValue: T): [T, (value: T) => void];
}

declare module "https://esm.sh/react-dom@18/client" {
  export function createRoot(container: Element | DocumentFragment): {
    render(node: unknown): void;
    unmount(): void;
  };
}
