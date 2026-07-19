# Airco Bridge for Homey

Airco Bridge connects Homey Pro to air conditioners exposed by [AircoBridge](https://github.com/CrazyHenk44/AircoBridge). Communication stays on the local network; no vendor cloud or app account is required by this Homey app.

## Features

- Power, target temperature and operating modes (`auto`, `cool`, `heat`, `dry`, `fan` and `off`)
- Full AircoBridge fan-speed control
- Horizontal and vertical vane control, including 3D Auto restrictions
- Indoor and outdoor temperature, error and status information
- Current power and cumulative energy consumption from AircoBridge history
- Automatic status refresh every 30 seconds

## Requirements

- Homey Pro running Homey OS 12.2.0 or newer
- A running AircoBridge instance reachable from Homey over HTTP or HTTPS
- At least one air conditioner configured in AircoBridge

## Pairing

1. In Homey, add a new **Airco Bridge** device.
2. Enter the complete bridge base URL, for example `http://192.168.1.50:3000`.
3. Select the air conditioner returned by the bridge.

The bridge URL and device ID can be changed later in the device's advanced settings.

## Development

```sh
npm ci
npm test
npx homey app validate --level verified
```

Install the development build on a connected Homey with:

```sh
npx homey app install
```

The GitHub validation workflow runs the unit tests and Homey's verified-level validator. Publishing through the included workflow additionally requires a `HOMEY_PAT` repository secret.

## Privacy and security

The app sends commands and polls status only between Homey and the bridge URL configured for each device. It does not collect analytics, store bridge responses outside Homey's normal device state, or send credentials to a third-party service. Use a trusted local AircoBridge instance and do not expose an unauthenticated bridge directly to the internet.

## Support

Report Homey app problems through [GitHub Issues](https://github.com/CrazyHenk44/Homey-AircoBridge/issues). AircoBridge server problems belong in the [AircoBridge repository](https://github.com/CrazyHenk44/AircoBridge/issues).

This is a community integration and is not affiliated with or endorsed by Mitsubishi Heavy Industries.

## License

[MIT](LICENSE)
