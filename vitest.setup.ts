// Tests never touch the network: any real fetch rejects, so a forgotten injection fails loudly.
globalThis.fetch = async (input) => {
  const url = input instanceof Request ? input.url : String(input);
  throw new Error(`network disabled in tests: ${url}`);
};
