import assert from "node:assert/strict";
import test from "node:test";
import {
  STATION_CATALOG,
  activeStationId,
  nextStation,
  stationSuggestions,
  stationsToInsert,
} from "../src/services/station-catalog.ts";
import { ROTATION_MS, StationRotation } from "../src/services/station-rotation.ts";

test("o catalogo traz as radios novas e deixa a Lofi Girl como padrao", () => {
  assert.equal(STATION_CATALOG.filter((station) => station.isDefault).length, 1);
  assert.equal(STATION_CATALOG[0]?.name, "Lofi Girl");
  assert.equal(STATION_CATALOG[0]?.isDefault, true);
  const names = STATION_CATALOG.map((station) => station.name);
  assert.deepEqual(names, [
    "Lofi Girl",
    "REYFM #LOFI",
    "FLUX FM ChillHop",
    "I Love Chillhop",
    "bigFM LoFi Focus",
    "0nlineradio LO-FI",
    "Lofi 24/7",
    "Chillofi",
    "24/7 Lofi Radio",
    "NIA Lo-Fi",
    "Nightwave Plaza",
  ]);
});

test("nao cadastra de novo uma radio que ja esta no banco", () => {
  const missing = stationsToInsert(
    [{ url: "https://play.streamafrica.net/lofiradio" }],
    STATION_CATALOG
  );
  assert.equal(missing.some((station) => station.name === "Lofi Girl"), false);
  assert.equal(missing.length, STATION_CATALOG.length - 1);
  assert.equal(missing[0]?.name, "REYFM #LOFI");
});

test("a proxima radio segue a ordem de cadastro e volta ao inicio", () => {
  const stations = [
    { id: 3, name: "c" },
    { id: 1, name: "a" },
    { id: 2, name: "b" },
  ];
  assert.equal(nextStation(stations, null)?.id, 1);
  assert.equal(nextStation(stations, 1)?.id, 2);
  assert.equal(nextStation(stations, 3)?.id, 1);
  assert.equal(nextStation([], 1), undefined);
});

test("depois de uma queda, a radio atual e reconhecida pelo endereco", () => {
  const stations = [
    { id: 1, url: "https://a.example/stream" },
    { id: 2, url: "https://b.example/stream" },
  ];
  assert.equal(activeStationId(stations, 2, "https://a.example/stream"), 2);
  assert.equal(activeStationId(stations, null, "https://b.example/stream"), 2);
  assert.equal(activeStationId(stations, null, null), null);
});

test("o campo do play mostra os nomes e filtra enquanto digita", () => {
  const stations = [{ name: "Lofi Girl" }, { name: "REYFM #LOFI" }, { name: "Chillofi" }];
  assert.deepEqual(stationSuggestions(stations, ""), [
    { name: "Lofi Girl", value: "Lofi Girl" },
    { name: "REYFM #LOFI", value: "REYFM #LOFI" },
    { name: "Chillofi", value: "Chillofi" },
  ]);
  assert.deepEqual(stationSuggestions(stations, "lofi"), [
    { name: "Lofi Girl", value: "Lofi Girl" },
    { name: "REYFM #LOFI", value: "REYFM #LOFI" },
    { name: "Chillofi", value: "Chillofi" },
  ]);
  assert.deepEqual(stationSuggestions(stations, "rey"), [
    { name: "REYFM #LOFI", value: "REYFM #LOFI" },
  ]);
  assert.deepEqual(stationSuggestions(stations, "zzz"), []);
});

test("a troca automatica espera 12 horas e recomeca quando alguem escolhe uma radio", async () => {
  assert.equal(ROTATION_MS, 12 * 60 * 60 * 1000);
  const { mock } = await import("node:test");
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let calls = 0;
    const rotation = new StationRotation(ROTATION_MS, () => {
      calls += 1;
    });
    rotation.started();
    mock.timers.tick(ROTATION_MS - 1);
    assert.equal(calls, 0);
    rotation.started();
    mock.timers.tick(ROTATION_MS - 1);
    assert.equal(calls, 0);
    mock.timers.tick(1);
    assert.equal(calls, 1);
    rotation.stopped();
    mock.timers.tick(ROTATION_MS);
    assert.equal(calls, 1);
  } finally {
    mock.timers.reset();
  }
});
