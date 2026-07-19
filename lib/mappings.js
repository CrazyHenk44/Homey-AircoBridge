"use strict";

const THERMOSTAT_MODES = ["off", "auto", "cool", "heat", "dry", "fan"];

const VANE_UD = {
  0: "auto",
  1: "highest",
  2: "middle",
  3: "normal",
  4: "lowest",
};

const VANE_LR = {
  0: "auto",
  1: "left-left",
  2: "left-middle",
  3: "middle-middle",
  4: "middle-right",
  5: "right-right",
  6: "left-right",
  7: "right-left",
};

function currentStatus(snapshot) {
  return snapshot?.status || snapshot?.device?.status || snapshot || {};
}

function currentOnline(snapshot) {
  if (typeof snapshot?.online === "boolean") return snapshot.online;
  if (typeof snapshot?.device?.online === "boolean") return snapshot.device.online;
  const status = currentStatus(snapshot);
  return status && Object.keys(status).length > 0;
}

function isAlarm(snapshot) {
  const status = currentStatus(snapshot);
  const errorCode = String(status.errorCode || "00");
  return !currentOnline(snapshot) || errorCode !== "00";
}

function thermostatModeFromStatus(snapshot) {
  const status = currentStatus(snapshot);
  if (!status.operation) return "off";
  const mode = String(status.operationModeName || status.operationMode || "auto");
  return THERMOSTAT_MODES.includes(mode) ? mode : "auto";
}

function toBooleanCapability(value) {
  return Boolean(value);
}

function toNumberCapability(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  THERMOSTAT_MODES,
  VANE_UD,
  VANE_LR,
  currentStatus,
  currentOnline,
  isAlarm,
  thermostatModeFromStatus,
  toBooleanCapability,
  toNumberCapability,
};
