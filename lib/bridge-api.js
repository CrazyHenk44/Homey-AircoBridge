"use strict";

const axios = require("axios");

function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || "").trim();
  if (!value) throw new Error("Bridge base URL is required");
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Bridge base URL must start with http:// or https://");
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

function joinPath(baseUrl, path) {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

function unwrapDeviceList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.aircos)) return payload.aircos;
  if (Array.isArray(payload?.devices)) return payload.devices;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function unwrapDeviceSnapshot(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return payload.device || payload.airco || payload;
}

function extractDeviceId(entry) {
  return String(
    entry?.id ??
    entry?.deviceId ??
    entry?.airco?.id ??
    entry?.airco?.deviceId ??
    ""
  );
}

function extractDeviceName(entry) {
  return String(
    entry?.name ??
    entry?.deviceName ??
    entry?.airco?.name ??
    entry?.airco?.deviceName ??
    extractDeviceId(entry)
  );
}

class BridgeApi {
  constructor(baseUrl, options = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.timeout = options.timeout || 10000;
    this.http = axios.create({
      timeout: this.timeout,
      validateStatus: () => true,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async request(method, path, body) {
    const url = joinPath(this.baseUrl, path);
    const response = await this.http.request({
      url,
      method,
      data: body,
    });

    const payload = response.data;
    if (response.status < 200 || response.status >= 300) {
      const message = payload?.error || payload?.message || `Request failed with ${response.status}`;
      throw new Error(message);
    }

    return payload;
  }

  async requestFirst(method, paths, body) {
    let lastError = null;
    for (const path of paths) {
      try {
        return await this.request(method, path, body);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Request failed");
  }

  async listDevices() {
    const payload = await this.requestFirst("GET", ["/api/aircos", "/api/devices"]);
    return unwrapDeviceList(payload).map((entry, index) => {
      const id = extractDeviceId(entry) || `device-${index + 1}`;
      return {
        id,
        name: extractDeviceName(entry),
        online: entry?.online,
        snapshot: entry,
      };
    });
  }

  async getDevice(deviceId) {
    const id = encodeURIComponent(String(deviceId));
    const payload = await this.requestFirst("GET", [
      `/api/aircos/${id}`,
      `/api/devices/${id}/status`,
    ]);
    return unwrapDeviceSnapshot(payload);
  }

  async command(deviceId, action, body) {
    const id = encodeURIComponent(String(deviceId));
    const paths = [
      `/api/aircos/${id}/${action}`,
      `/api/devices/${id}/${action}`,
    ];
    return this.requestFirst("POST", paths, body);
  }

  async refresh(deviceId) {
    const id = encodeURIComponent(String(deviceId));
    return this.requestFirst("GET", [
      `/api/aircos/${id}`,
      `/api/devices/${id}/status`,
    ]);
  }

  async commandAndRefresh(deviceId, action, body) {
    await this.command(deviceId, action, body);
    return this.refresh(deviceId);
  }
}

module.exports = {
  BridgeApi,
  normalizeBaseUrl,
  joinPath,
  unwrapDeviceList,
  unwrapDeviceSnapshot,
  extractDeviceId,
  extractDeviceName,
};
