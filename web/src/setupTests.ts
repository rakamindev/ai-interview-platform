import "@testing-library/jest-dom";

// jsdom doesn't implement the Pointer Events APIs Radix's interactive overlays
// (DropdownMenu, Select, Dialog, ...) rely on to open/close — without these, a
// trigger click silently no-ops instead of opening the menu.
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (!window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
