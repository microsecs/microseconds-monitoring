/** Approximate IP-derived geography, never an exact device position. */
export default function LocationMapLink({ location }: { location: string }) {
  const valid = !!location && location !== "—" && location.toLowerCase() !== "unknown";
  if (!valid) return <span>{location || "Unknown"}</span>;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  return (
    <a className="locationMapLink" href={url} target="_blank" rel="noopener noreferrer" title={`View approximate IP location: ${location} in Google Maps`}>
      {location}
    </a>
  );
}
