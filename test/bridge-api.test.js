"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BridgeApi,
  normalizeBaseUrl,
  joinPath,
  unwrapDeviceList,
  unwrapDeviceSnapshot,
  extractDeviceId,
  extractDeviceName,
} = require("../lib/bridge-api");

test("normalizeBaseUrl accepts HTTP(S), trims whitespace and removes trailing slashes", () => {
  assert.equal(normalizeBaseUrl(" http://bridge.local:3000/ "), "http://bridge.local:3000");
  assert.equal(normalizeBaseUrl("https://bridge.local/base///"), "https://bridge.local/base");
  assert.throws(() => normalizeBaseUrl(""), /required/);
  assert.throws(() => normalizeBaseUrl("ftp://bridge.local"), /http:\/\/ or https:\/\//);
});

test("joinPath joins normalized bridge and API paths", () => {
  assert.equal(joinPath("http://bridge:3000/", "/api/aircos"), "http://bridge:3000/api/aircos");
  assert.equal(joinPath("http://bridge:3000", "api/devices"), "http://bridge:3000/api/devices");
});

test("payload helpers support current and legacy bridge response shapes", () => {
  const entries = [{ id: "living-room" }];
  const snapshot = { status: { operation: true } };

  assert.equal(unwrapDeviceList(entries), entries);
  assert.equal(unwrapDeviceList({ aircos: entries }), entries);
  assert.equal(unwrapDeviceList({ devices: entries }), entries);
  assert.equal(unwrapDeviceList({ result: entries }), entries);
  assert.deepEqual(unwrapDeviceList({}), []);
  assert.equal(unwrapDeviceSnapshot({ device: snapshot }), snapshot);
  assert.equal(unwrapDeviceSnapshot({ airco: snapshot }), snapshot);
  assert.equal(unwrapDeviceSnapshot(snapshot), snapshot);
});

test("device identity helpers support flat and nested entries", () => {
  assert.equal(extractDeviceId({ id: "living-room" }), "living-room");
  assert.equal(extractDeviceId({ deviceId: 2 }), "2");
  assert.equal(extractDeviceId({ airco: { id: "bedroom" } }), "bedroom");
  assert.equal(extractDeviceName({ name: "Living room" }), "Living room");
  assert.equal(extractDeviceName({ deviceName: "Bedroom" }), "Bedroom");
  assert.equal(extractDeviceName({ airco: { deviceName: "Office" } }), "Office");
  assert.equal(extractDeviceName({ id: "fallback" }), "fallback");
});

test("requestFirst tries legacy routes after a failed preferred route", async () => {
  const api = new BridgeApi("http://bridge:3000");
  const calls = [];
  api.request = async (method, path, body) => {
    calls.push({ method, path, body });
    if (path === "/api/aircos") throw new Error("not found");
    return { devices: [] };
  };

  const payload = await api.requestFirst("GET", ["/api/aircos", "/api/devices"]);

  assert.deepEqual(payload, { devices: [] });
  assert.deepEqual(calls.map(({ path }) => path), ["/api/aircos", "/api/devices"]);
});

test("listDevices normalizes bridge entries and generates a missing ID", async () => {
  const api = new BridgeApi("http://bridge:3000");
  api.requestFirst = async () => ({
    aircos: [
      { id: "living-room", name: "Living room", online: true },
      { deviceId: 2, deviceName: "Bedroom", online: false },
      { name: "Unknown" },
    ],
  });

  assert.deepEqual(await api.listDevices(), [
    {
      id: "living-room",
      name: "Living room",
      online: true,
      snapshot: { id: "living-room", name: "Living room", online: true },
    },
    {
      id: "2",
      name: "Bedroom",
      online: false,
      snapshot: { deviceId: 2, deviceName: "Bedroom", online: false },
    },
    {
      id: "device-3",
      name: "Unknown",
      online: undefined,
      snapshot: { name: "Unknown" },
    },
  ]);
});

test("refresh safely encodes the bridge device ID in all routes", async () => {
  const api = new BridgeApi("http://bridge:3000");
  let paths;
  api.requestFirst = async (method, candidatePaths) => {
    assert.equal(method, "GET");
    paths = candidatePaths;
    return {};
  };

  await api.refresh("living room/1");

  assert.deepEqual(paths, [
    "/api/aircos/living%20room%2F1",
    "/api/devices/living%20room%2F1/status",
  ]);
});
