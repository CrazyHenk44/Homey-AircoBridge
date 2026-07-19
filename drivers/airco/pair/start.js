"use strict";

const baseUrlInput = document.getElementById("baseUrl");
const loadDevicesButton = document.getElementById("loadDevices");
const retryButton = document.getElementById("retry");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("error");
const deviceListEl = document.getElementById("deviceList");

function setStatus(text) {
  statusEl.textContent = text;
}

function setError(text) {
  errorEl.textContent = text || "";
}

function renderPlaceholder(text) {
  deviceListEl.replaceChildren();
  const item = document.createElement("li");
  item.textContent = text;
  deviceListEl.appendChild(item);
}

async function preparePairing() {
  const baseUrl = baseUrlInput.value.trim();
  setError("");
  setStatus("Checking bridge...");
  renderPlaceholder("Waiting for device list...");

  try {
    const validation = await Homey.emit("validate_base_url", { baseUrl });
    if (!validation?.ok) {
      throw new Error("Bridge did not return a valid response");
    }

    await Homey.emit("set_base_url", { baseUrl });
    setStatus("Bridge found. Moving to device selection...");
    renderPlaceholder("Loading next step...");

    if (typeof Homey.nextView === "function") {
      await Homey.nextView();
      return;
    }

    throw new Error("This Homey pairing view does not support moving to the next step.");
  } catch (err) {
    setStatus("Could not continue to device selection.");
    setError(err?.message || String(err));
  }
}

loadDevicesButton.addEventListener("click", preparePairing);
retryButton.addEventListener("click", preparePairing);
baseUrlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") preparePairing();
});

setStatus("Enter the bridge base URL and continue to device selection.");
renderPlaceholder("No device list yet.");
