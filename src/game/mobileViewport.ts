const KEYBOARD_THRESHOLD = 100

export function calculateKeyboardInset(
  stableHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number {
  const coveredHeight = Math.max(0, stableHeight - visualHeight - visualOffsetTop)
  return coveredHeight >= KEYBOARD_THRESHOLD ? coveredHeight : 0
}

export function isKeyboardViewport(
  stableWidth: number,
  stableHeight: number,
  currentWidth: number,
  visualHeight: number,
  inputFocused: boolean,
): boolean {
  const widthIsStable = Math.abs(currentWidth - stableWidth) < 80
  const heightDrop = stableHeight - visualHeight
  return inputFocused && widthIsStable && heightDrop >= KEYBOARD_THRESHOLD
}