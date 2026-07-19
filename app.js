"use strict";

const Homey = require("homey");

class AircoApp extends Homey.App {
  async onInit() {
    this.log("Airco Bridge app initialized");
  }
}

module.exports = AircoApp;
