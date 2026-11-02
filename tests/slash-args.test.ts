import assert from "node:assert/strict";
import test from "node:test";
import { argsFromOptions, slashBodies, type SlashOptionValues } from "../src/commands/slash-args.ts";

function options(values: { strings?: Record<string, string | null>; integers?: Record<string, number | null> }): SlashOptionValues {
  return {
    string(name: string) {
      return values.strings?.[name] ?? null;
    },
    integer(name: string) {
      return values.integers?.[name] ?? null;
    },
  };
}

test("publica os comandos que o menu precisa", () => {
  const names = slashBodies.map((body) => body.name).sort();
  assert.deepEqual(names, [
    "addstation",
    "globalrank",
    "health",
    "play",
    "profile",
    "rank",
    "removestation",
    "setdefault",
    "stations",
    "stop",
  ]);
});

test("play aceita o nome da radio e tambem roda sem ele", () => {
  const play = slashBodies.find((body) => body.name === "play");
  assert.ok(play);
  assert.deepEqual(play.options, [
    {
      type: 3,
      name: "station",
      description: "Station name or id",
      required: false,
    },
  ]);
  assert.deepEqual(argsFromOptions("play", options({ strings: { station: "Lofi Girl" } })), [
    "Lofi",
    "Girl",
  ]);
  assert.deepEqual(argsFromOptions("play", options({})), []);
});

test("addstation guarda o nome inteiro, mesmo com espaco", () => {
  const add = slashBodies.find((body) => body.name === "addstation");
  assert.ok(add);
  assert.equal(add.options?.find((option) => option.name === "name")?.required, true);
  assert.equal(add.options?.find((option) => option.name === "url")?.required, true);
  assert.equal(add.options?.find((option) => option.name === "description")?.required, false);
  assert.deepEqual(
    argsFromOptions(
      "addstation",
      options({
        strings: {
          name: "Lofi Girl",
          url: "https://example.com/stream",
          description: "beats to study",
        },
      })
    ),
    ["Lofi Girl", "https://example.com/stream", "beats to study"]
  );
});

test("removestation e setdefault recebem o id numerico", () => {
  assert.equal(slashBodies.find((body) => body.name === "removestation")?.options?.[0]?.type, 4);
  assert.equal(slashBodies.find((body) => body.name === "setdefault")?.options?.[0]?.type, 4);
  assert.deepEqual(argsFromOptions("removestation", options({ integers: { id: 3 } })), ["3"]);
  assert.deepEqual(argsFromOptions("setdefault", options({})), []);
});
