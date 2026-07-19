"use strict";

const Homey = require("homey");
const { BridgeApi, normalizeBaseUrl, extractDeviceName } = require("../../lib/bridge-api");

function buildDeviceDescriptor(baseUrl, entry) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return {
    name: extractDeviceName(entry),
    data: {
      id: String(entry.id),
    },
    settings: {
      baseUrl: normalizedBaseUrl,
      deviceId: String(entry.id),
    },
    store: {
      baseUrl: normalizedBaseUrl,
      deviceId: String(entry.id),
    },
  };
}

class AircoDriver extends Homey.Driver {
  async onInit() {
    this.log("Airco driver initialized");
  }

  async onPair(session) {
    let pairBaseUrl = null;

    session.setHandler("set_base_url", async ({ baseUrl }) => {
      pairBaseUrl = normalizeBaseUrl(baseUrl);
      return {
        ok: true,
      };
    });

    session.setHandler("list_devices", async () => {
      if (!pairBaseUrl) {
        throw new Error("Bridge base URL is missing");
      }

      const api = new BridgeApi(pairBaseUrl);
      const devices = await api.listDevices();
      return devices.map((device) => buildDeviceDescriptor(pairBaseUrl, device));
    });

    session.setHandler("validate_base_url", async ({ baseUrl }) => {
      const api = new BridgeApi(baseUrl);
      const devices = await api.listDevices();
      return {
        ok: true,
        devices: devices.map((device) => ({
          id: device.id,
          name: device.name,
        })),
      };
    });
  }
}

module.exports = AircoDriver;
