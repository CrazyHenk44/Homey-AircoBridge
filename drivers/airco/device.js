"use strict";

const Homey = require("homey");
const {
  BridgeApi,
  normalizeBaseUrl,
} = require("../../lib/bridge-api");
const {
  currentStatus,
  currentOnline,
  isAlarm,
  thermostatModeFromStatus,
  toBooleanCapability,
  toNumberCapability,
} = require("../../lib/mappings");

const POLL_INTERVAL_MS = 30000;
const REQUIRED_CAPABILITIES = [
  "measure_power",
  "meter_power",
];
const LEGACY_CAPABILITIES = [
  "airco_cool_hot_judge",
  "fan_mode",
];

function statusOrEmpty(snapshot) {
  return currentStatus(snapshot) || {};
}

function stringValue(value, fallback = "") {
  if (value == null) return fallback;
  return String(value);
}

class AircoDevice extends Homey.Device {
  async onInit() {
    this._pollTimer = null;
    this._refreshInFlight = null;
    this._lastSnapshot = null;
    this._baseUrl = null;
    this._deviceId = null;

    await this._ensureCapabilities();
    this._registerCapabilityListeners();
    await this._reloadFromSettings();
    this._startPolling();
    try {
      await this.refreshFromBridge();
    } catch (err) {
      this.error("Initial refresh failed", err);
    }
  }

  async onSettings({ newSettings }) {
    this._baseUrl = null;
    this._deviceId = null;
    await this._reloadFromSettings(newSettings);
    try {
      await this.refreshFromBridge();
    } catch (err) {
      this.error("Refresh after settings change failed", err);
    }
  }

  onDeleted() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = null;
  }

  async _ensureCapabilities() {
    for (const capabilityId of REQUIRED_CAPABILITIES) {
      if (this.hasCapability(capabilityId)) continue;
      await this.addCapability(capabilityId);
    }

    for (const capabilityId of LEGACY_CAPABILITIES) {
      if (!this.hasCapability(capabilityId)) continue;
      await this.removeCapability(capabilityId);
    }
  }

  _assertManualVaneAllowed() {
    const status = statusOrEmpty(this._lastSnapshot);
    if (status.entrust) {
      throw new Error("Niet beschikbaar terwijl 3D auto aan staat");
    }
  }

  _registerCapabilityListeners() {
    this.registerCapabilityListener("onoff", async (value) => {
      await this.commandAndRefresh("power", { power: value ? "on" : "off" });
    });

    this.registerCapabilityListener("target_temperature", async (value) => {
      await this.commandAndRefresh("temperature", { temperature: Number(value) });
    });

    this.registerCapabilityListener("thermostat_mode", async (value) => {
      const mode = String(value);
      if (mode === "off") {
        await this.commandAndRefresh("power", { power: "off" });
        return;
      }
      await this.commandAndRefresh("mode", {
        mode,
      });
    });

    this.registerCapabilityListener("airco_fan_mode", async (value) => {
      await this.commandAndRefresh("airflow", {
        airflow: String(value),
      });
    });

    this.registerCapabilityListener("airco_vane_ud", async (value) => {
      this._assertManualVaneAllowed();
      await this.commandAndRefresh("vane", {
        windDirectionUD: Number(value),
      });
    });

    this.registerCapabilityListener("airco_vane_lr", async (value) => {
      this._assertManualVaneAllowed();
      await this.commandAndRefresh("vane", {
        windDirectionLR: Number(value),
      });
    });

    this.registerCapabilityListener("airco_entrust", async (value) => {
      await this.commandAndRefresh("entrust", {
        entrust: Boolean(value),
      });
    });

    this.registerCapabilityListener("airco_vacant_property", async (value) => {
      await this.commandAndRefresh("vacant-preset", {
        vacant: Boolean(value),
      });
    });
  }

  async _reloadFromSettings(settings = this.getSettings()) {
    const store = this.getStore?.() || {};
    const baseUrl = settings.baseUrl || store.baseUrl || this._baseUrl;
    const deviceId = settings.deviceId || store.deviceId || this._deviceId;

    if (!baseUrl || !deviceId) {
      throw new Error("Device configuration needs baseUrl and deviceId");
    }

    this._baseUrl = normalizeBaseUrl(baseUrl);
    this._deviceId = String(deviceId);
    this._api = new BridgeApi(this._baseUrl);
  }

  _startPolling() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = setInterval(() => {
      this.refreshFromBridge().catch((err) => {
        this.error("Polling failed", err);
      });
    }, POLL_INTERVAL_MS);
  }

  async _withRefreshLock(fn) {
    const previous = this._refreshInFlight || Promise.resolve();
    const current = previous.then(fn, fn);
    this._refreshInFlight = current.catch(() => {});
    return current;
  }

  async commandAndRefresh(action, body) {
    return this._withRefreshLock(async () => {
      await this._api.command(this._deviceId, action, body);
      const snapshot = await this._fetchAndApply();
      return snapshot;
    });
  }

  async refreshFromBridge() {
    return this._withRefreshLock(() => this._fetchAndApply());
  }

  async _fetchAndApply() {
    try {
      const snapshot = await this._api.refresh(this._deviceId);
      this._lastSnapshot = snapshot;
      await this._applySnapshot(snapshot);
      return snapshot;
    } catch (err) {
      await this.setUnavailable(err?.message || "Bridge unavailable");
      await this._setCapability("alarm_generic", true);
      throw err;
    }
  }

  async _applySnapshot(snapshot) {
    const status = statusOrEmpty(snapshot);
    const history = snapshot?.history || null;
    const online = currentOnline(snapshot);
    const alarm = isAlarm(snapshot);

    if (online) await this.setAvailable();
    else await this.setUnavailable("Bridge or airco is offline");

    await this._setCapability("onoff", Boolean(status.operation));
    await this._setCapability("measure_temperature", toNumberCapability(status.indoorTemp));
    await this._setCapability("target_temperature", toNumberCapability(status.presetTemp));
    await this._setCapability("thermostat_mode", thermostatModeFromStatus(snapshot));
    await this._setCapability("alarm_generic", alarm);

    await this._setCapability("airco_fan_mode", stringValue(status.airFlowName || status.airFlow));
    await this._setCapability("airco_vane_ud", stringValue(status.windDirectionUD));
    await this._setCapability("airco_vane_lr", stringValue(status.windDirectionLR));
    await this._setCapability("airco_indoor_temperature", toNumberCapability(status.indoorTemp));
    await this._setCapability("airco_outdoor_temperature", toNumberCapability(status.outdoorTemp));
    await this._setCapability("measure_power", toNumberCapability(history?.currentWatts));
    await this._setCapability("meter_power", toNumberCapability(history?.totalKwh));
    await this._setCapability("airco_electric", toNumberCapability(status.electric));
    await this._setCapability("airco_error_code", stringValue(status.errorCode, "00"));
    await this._setCapability("airco_entrust", toBooleanCapability(status.entrust));
    await this._setCapability("airco_vacant_property", toBooleanCapability(status.isVacantProperty));
    await this._setCapability("airco_self_clean_operation", toBooleanCapability(status.isSelfCleanOperation));
  }

  async _setCapability(capabilityId, value) {
    try {
      await this.setCapabilityValue(capabilityId, value);
    } catch (err) {
      this.error(`Failed to set capability ${capabilityId}`, err);
    }
  }
}

module.exports = AircoDevice;
