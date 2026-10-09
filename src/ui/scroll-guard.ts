/** Keep unused horizontal trackpad gestures from navigating browser history. */
export function installScrollGuard(): () => void {
  const onWheel = (event: WheelEvent) => {
    // Blockly consumes its own pan/zoom events before they reach this listener.
    // Leave pinch zoom and primarily vertical scrolling to their usual handlers.
    if (event.defaultPrevented || event.ctrlKey || !event.cancelable ||
        event.deltaX === 0 || Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;

    for (const target of event.composedPath()) {
      if (!(target instanceof HTMLElement)) continue;
      const { overflowX, direction } = getComputedStyle(target);
      if (!/^(auto|scroll|overlay)$/.test(overflowX)) continue;
      const max = target.scrollWidth - target.clientWidth;
      if (max <= 0) continue;
      const min = direction === 'rtl' ? -max : 0;
      const end = direction === 'rtl' ? 0 : max;
      if ((event.deltaX < 0 && target.scrollLeft > min) ||
          (event.deltaX > 0 && target.scrollLeft < end)) return;
    }

    event.preventDefault();
  };
  window.addEventListener('wheel', onWheel, { passive: false });
  return () => window.removeEventListener('wheel', onWheel);
}
