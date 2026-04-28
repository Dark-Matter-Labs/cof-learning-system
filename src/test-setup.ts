import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView (guard: node env tests don't have Element)
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}
