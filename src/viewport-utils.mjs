/**
 * The keyboard changes the visual viewport, not the invitation's page geometry.
 * Keep that geometry until editing finishes; real window/orientation changes
 * can then resize every scene together.
 * @param {{width: number, layoutHeight: number, visualHeight: number, visualTop?: number, scale?: number, focused: boolean, previousWidth: number, previousHeight: number, wasKeyboardOpen: boolean}} input
 */
export function resolveViewport(input) {
  const rotated = Math.abs(input.width - input.previousWidth) > 60;
  const baseline = rotated ? input.layoutHeight : Math.max(input.previousHeight, input.layoutHeight);
  const keyboardOpen = !rotated && (input.scale ?? 1) < 1.1 && (input.focused || input.wasKeyboardOpen) && baseline - input.visualHeight > 120;
  const height = !rotated && (input.focused || keyboardOpen) ? input.previousHeight : input.layoutHeight;
  return { height: Math.round(height), keyboardOpen, keyboardInset: keyboardOpen ? Math.max(0, Math.round(height - input.visualHeight - (input.visualTop ?? 0))) : 0, rotated };
}

/** @param {number} width */
export function effectBudget(width) {
  return { mobile: width < 700, cloudRatio: 1.5, cloudQuality: 0.4, cloudFps: 120, flameRatio: 1.25, flameFps: 120, rippleRatio: 1.5, rippleFps: 120 };
}
