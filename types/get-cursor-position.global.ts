declare module 'get-cursor-position' {
  interface ICursorPosition {
    row: number;
    col: number;
  }

  export function sync(): ICursorPosition;
}
