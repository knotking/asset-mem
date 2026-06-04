/** Placeholder written to Firestore until document analysis supplies an address. */
export const PENDING_PROPERTY_ADDRESS = 'Pending address...';

/** Legacy placeholder from older mapp builds — still updated on analysis complete. */
export const LEGACY_PROCESSING_PROPERTY_ADDRESS = 'Processing...';

export function isPlaceholderPropertyAddress(address: string | undefined): boolean {
  return (
    address === PENDING_PROPERTY_ADDRESS || address === LEGACY_PROCESSING_PROPERTY_ADDRESS
  );
}
