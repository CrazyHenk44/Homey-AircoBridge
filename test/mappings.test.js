"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  currentStatus,
  currentOnline,
  isAlarm,
  thermostatModeFromStatus,
  toBooleanCapability,
  toNumberCapability,
} = require("../lib/mappings");

test("currentStatus supports bridge, nested device and plain status payloads", () => {
  const status = { operation: true };

  assert.equal(currentStatus({ status }), status);
  assert.equal(currentStatus({ device: { status } }), status);
  assert.equal(currentStatus(status), status);
  assert.deepEqual(currentStatus(null), {});
});

test("currentOnline prefers explicit bridge state and otherwise infers status", () => {
  assert.equal(currentOnline({ online: false, status: { operation: true } }), false);
  assert.equal(currentOnline({ device: { online: true, status: {} } }), true);
  assert.equal(currentOnline({ status: { operation: false } }), true);
  assert.equal(currentOnline({ status: {} }), false);
});

test("isAlarm reports offline devices and non-zero error codes", () => {
  assert.equal(isAlarm({ online: true, status: { errorCode: "00" } }), false);
  assert.equal(isAlarm({ online: true, status: { errorCode: "E01" } }), true);
  assert.equal(isAlarm({ online: false, status: { errorCode: "00" } }), true);
});

test("thermostatModeFromStatus maps power and supported bridge modes", () => {
  assert.equal(thermostatModeFromStatus({ status: { operation: false, operationModeName: "cool" } }), "off");
  assert.equal(thermostatModeFromStatus({ status: { operation: true, operationModeName: "dry" } }), "dry");
  assert.equal(thermostatModeFromStatus({ status: { operation: true, operationMode: "fan" } }), "fan");
  assert.equal(thermostatModeFromStatus({ status: { operation: true, operationModeName: "unknown" } }), "auto");
});

test("capability converters return Homey-safe values", () => {
  assert.equal(toBooleanCapability(1), true);
  assert.equal(toBooleanCapability(0), false);
  assert.equal(toNumberCapability("21.5"), 21.5);
  assert.equal(toNumberCapability(0), 0);
  assert.equal(toNumberCapability(""), null);
  assert.equal(toNumberCapability(undefined), null);
  assert.equal(toNumberCapability("not-a-number"), null);
  assert.equal(toNumberCapability(Infinity), null);
});
