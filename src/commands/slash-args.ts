export interface SlashOption {
  type: 3 | 4;
  name: string;
  description: string;
  required: boolean;
}

export interface SlashBody {
  name: string;
  description: string;
  options?: SlashOption[];
}

export interface SlashOptionValues {
  string(name: string): string | null;
  integer(name: string): number | null;
}

const stationOption: SlashOption = {
  type: 3,
  name: "station",
  description: "Station name or id",
  required: false,
};

const idOption: SlashOption = {
  type: 4,
  name: "id",
  description: "Station id",
  required: true,
};

export const slashBodies: SlashBody[] = [
  {
    name: "play",
    description: "Play a radio station in your voice channel",
    options: [stationOption],
  },
  {
    name: "stop",
    description: "Stop playing and leave the voice channel",
  },
  {
    name: "stations",
    description: "List all available radio stations",
  },
  {
    name: "health",
    description: "Check bot health status",
  },
  {
    name: "profile",
    description: "View your lofi profile",
  },
  {
    name: "rank",
    description: "View server leaderboard",
  },
  {
    name: "globalrank",
    description: "View global leaderboard",
  },
  {
    name: "addstation",
    description: "Add a new radio station",
    options: [
      { type: 3, name: "name", description: "Station name", required: true },
      { type: 3, name: "url", description: "Direct stream URL", required: true },
      { type: 3, name: "description", description: "Short description", required: false },
    ],
  },
  {
    name: "removestation",
    description: "Remove a radio station",
    options: [idOption],
  },
  {
    name: "setdefault",
    description: "Set the default radio station",
    options: [idOption],
  },
];

export function argsFromOptions(commandName: string, options: SlashOptionValues): string[] {
  if (commandName === "play") {
    const station = options.string("station")?.trim();
    if (!station) return [];
    return station.split(/\s+/);
  }

  if (commandName === "addstation") {
    const name = options.string("name")?.trim();
    const url = options.string("url")?.trim();
    if (!name || !url) return [];
    const description = options.string("description")?.trim();
    return description ? [name, url, description] : [name, url];
  }

  if (commandName === "removestation" || commandName === "setdefault") {
    const id = options.integer("id");
    if (id == null) return [];
    return [String(id)];
  }

  return [];
}
