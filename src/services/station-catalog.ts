export interface CatalogStation {
  name: string;
  url: string;
  description: string;
  isDefault?: boolean;
}

export const STATION_CATALOG: CatalogStation[] = [
  {
    name: "Lofi Girl",
    url: "https://play.streamafrica.net/lofiradio",
    description: "Lofi hip hop radio - beats to relax/study to",
    isDefault: true,
  },
  {
    name: "REYFM #LOFI",
    url: "https://listen.reyfm.de/lofi_320kbps.mp3",
    description: "Lofi em 320 kbps",
  },
  {
    name: "FLUX FM ChillHop",
    url: "https://streams.fluxfm.de/Chillhop/mp3-320/streams.fluxfm.de/",
    description: "Chillhop em 320 kbps",
  },
  {
    name: "I Love Chillhop",
    url: "https://ilm.stream12.radiohost.de/ilm_ilovechillhop_mp3-192",
    description: "Chillhop em 192 kbps",
  },
  {
    name: "bigFM LoFi Focus",
    url: "https://stream.bigfm.de/lofifocus/mp3-128/radiobrowser",
    description: "Lofi para foco",
  },
  {
    name: "0nlineradio LO-FI",
    url: "https://stream.0nlineradio.com/lo-fi",
    description: "Lofi continuo",
  },
  {
    name: "Lofi 24/7",
    url: "http://usa9.fastcast4u.com/proxy/jamz?mp=/1",
    description: "Chillout e lofi",
  },
  {
    name: "Chillofi",
    url: "http://streams.dez.ovh:8000/radio.mp3",
    description: "Lo-fi do Kalizo",
  },
  {
    name: "24/7 Lofi Radio",
    url: "https://ec3.yesstreaming.net:3755/stream",
    description: "Lofi continuo",
  },
  {
    name: "NIA Lo-Fi",
    url: "https://radio.nia.nc/radio/8020/lofi-hq-stream.aac",
    description: "Lofi em AAC",
  },
  {
    name: "Nightwave Plaza",
    url: "http://radio.plaza.one/mp3",
    description: "Vaporwave",
  },
];

export function stationsToInsert(
  existing: readonly { url: string }[],
  catalog: readonly CatalogStation[]
): CatalogStation[] {
  const urls = new Set(existing.map((station) => station.url));
  return catalog.filter((station) => !urls.has(station.url));
}

export function nextStation<T extends { id: number }>(
  stations: readonly T[],
  currentId: number | null
): T | undefined {
  if (stations.length === 0) return undefined;
  const ordered = [...stations].sort((left, right) => left.id - right.id);
  if (currentId == null) return ordered[0];
  const index = ordered.findIndex((station) => station.id === currentId);
  const nextIndex = index < 0 ? 0 : (index + 1) % ordered.length;
  return ordered[nextIndex];
}

export function activeStationId(
  stations: readonly { id: number; url: string }[],
  currentId: number | null,
  currentUrl: string | null
): number | null {
  if (currentId != null && stations.some((station) => station.id === currentId)) {
    return currentId;
  }
  if (!currentUrl) return null;
  return stations.find((station) => station.url === currentUrl)?.id ?? null;
}

export function stationSuggestions(
  stations: readonly { name: string }[],
  query: string,
  limit = 25
): { name: string; value: string }[] {
  const needle = query.trim().toLowerCase();
  const matched =
    needle.length === 0
      ? stations
      : stations.filter((station) => station.name.toLowerCase().includes(needle));
  return matched.slice(0, limit).map((station) => {
    const label = station.name.slice(0, 100);
    return { name: label, value: label };
  });
}
