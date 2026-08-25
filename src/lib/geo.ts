/**
 * Google Maps links come in several shapes. Pulling coordinates out where possible
 * means the CRM can show a pin instead of only a link — and the link is kept either
 * way, since a shortened one (maps.app.goo.gl) cannot be parsed without following it.
 */
export function parseMapLink(link?: string | null): { latitude?: number; longitude?: number } {
  if (!link) return {};

  const patterns = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,      // .../@23.1815,79.9864,17z
    /[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,  // ...?q=23.1815,79.9864
    /[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ...?ll=23.1815,79.9864
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,      // place links
    /^\s*(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)\s*$/, // pasted coordinates
  ];

  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) {
      const latitude = Number(match[1]);
      const longitude = Number(match[2]);
      if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
    }
  }

  return {};
}

/**
 * A link that opens the pin, whatever the owner gave us.
 *
 * The stored value may be a full Maps URL, a bare pair of coordinates from the
 * "use my location" button, or nothing at all — only the first is a usable href, so
 * the others are turned into one here. Passing coordinates through untouched made
 * the browser read them as a path on this site, which is how you ended up on a 404.
 */
export function mapHref(input: {
  mapLink?: string | null;
  latitude?: any;
  longitude?: any;
  addressLine?: string | null;
}): string | null {
  const link = input.mapLink?.trim();

  if (link) {
    // A real link — use it as given.
    if (/^https?:\/\//i.test(link)) return link;

    // Coordinates, with or without spaces.
    const coordinates = link.match(/^\s*(-?\d{1,3}\.?\d*)\s*,\s*(-?\d{1,3}\.?\d*)\s*$/);
    if (coordinates) return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}`;

    // Something else the owner typed — search for it.
    return `https://www.google.com/maps/search/${encodeURIComponent(link)}`;
  }

  if (input.latitude && input.longitude) {
    return `https://www.google.com/maps?q=${input.latitude},${input.longitude}`;
  }

  if (input.addressLine) {
    return `https://www.google.com/maps/search/${encodeURIComponent(input.addressLine)}`;
  }

  return null;
}

/** Coordinates for an inline map preview, when we have them. */
export function mapEmbed(input: { mapLink?: string | null; latitude?: any; longitude?: any }): string | null {
  const fromLink = parseMapLink(input.mapLink);
  const latitude = fromLink.latitude ?? (input.latitude ? Number(input.latitude) : undefined);
  const longitude = fromLink.longitude ?? (input.longitude ? Number(input.longitude) : undefined);
  if (!latitude || !longitude) return null;
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
}
