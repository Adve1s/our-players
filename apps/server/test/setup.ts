// Tests never touch the network: any real fetch fails loudly.
globalThis.fetch = (input) => {
  throw new Error(`Real network access in a test: ${String(input)}`);
};
