#pragma once

// Secret-free compile template only. Copy locally to GCConfig.h and replace
// placeholders before using hardware. Never commit GCConfig.h.

// Local identity and network values: no real credentials or endpoints here.
#define GC_WIFI_SSID "REPLACE_LOCALLY"
#define GC_WIFI_PASSWORD "REPLACE_LOCALLY"
#define GC_HOSTNAME "greencontrol-local"
#define GC_API_URL "https://example.invalid/api/device/heartbeat"
#define GC_COMMAND_POLL_URL "https://example.invalid/api/device/commands/poll"
#define GC_DEVICE_ID "REPLACE_LOCALLY"
#define GC_DEVICE_SECRET "REPLACE_LOCALLY"
#define GC_FIRMWARE_VERSION "REPLACE_LOCALLY"

// The poll transport requires a verified PEM root CA and refuses placeholders.
// Provision the root that validates the configured API host. Do not use
// setInsecure() or a guessed certificate. Certificate rotation is an explicit
// local maintenance operation until a managed trust bundle is introduced.
#define GC_TLS_ROOT_CA_PEM R"GCPEM(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_VERIFIED_ROOT_CA
-----END CERTIFICATE-----
)GCPEM"

// Confirm locally before hardware use. These values exist only so the
// secret-free template can be compiled without contacting or flashing a device.
#define GC_WIFI_RETRY_MS 10000UL
#define GC_TEMPERATURE_INTERVAL_MS 10000UL
#define GC_HEARTBEAT_INTERVAL_MS 30000UL
#define GC_COMMAND_POLL_INTERVAL_MS 1500UL
#define GC_COMMAND_POLL_MAX_BACKOFF_MS 10000UL
#define GC_COMMAND_POLL_CONNECT_TIMEOUT_MS 3000UL
#define GC_COMMAND_POLL_REQUEST_TIMEOUT_MS 5000UL
// Enable only during an attended hardware test. Logs contain no credentials.
#define GC_COMMAND_DIAGNOSTICS 0
#define GC_CLOUD_COMMAND_TIMEOUT_MS 120000UL
#define GC_VALID_TEMP_MIN_C -55.0F
#define GC_VALID_TEMP_MAX_C 125.0F
#define GC_WATERING_FROST_LOCK_C 2.0F
#define GC_MAX_MOTOR_RUNTIME_MS 120000UL

// Current verified Phase 1B hardware baseline:
// - DS18B20 uses GPIO21 in GCTemperatureService.cpp.
// - Watering is physical CH5, represented as zero-based firmware channel 4.
// - Roof CH1/CH2 and wall CH3/CH4 must remain disabled.
#define GC_RELAY_ROOF_OPEN 0
#define GC_RELAY_ROOF_CLOSE 1
#define GC_RELAY_WALL_OPEN 2
#define GC_RELAY_WALL_CLOSE 3
#define GC_RELAY_WATERING 4

// Sentinel for an unverified channel. Replace locally before hardware use.
#define GC_RELAY_HEATING 255

// Outputs are disabled in the checked-in compile template. A local operator
// must consciously configure the tested device; window channels are still
// blocked by the firmware baseline even when outputs are enabled locally.
#define GC_ENABLE_OUTPUTS false
#define GC_RELAY_ACTIVE_HIGH true

// Board-specific values are not yet reliably established for the repository.
// 255/0x00 are deliberate inert sentinels, not claimed hardware values.
#define GC_I2C_SDA_PIN 255
#define GC_I2C_SCL_PIN 255
#define GC_TCA9554_ADDRESS 0x00
#define GC_INPUT_ACTIVE_LOW true
#define GC_DI_ROOF_OPEN 255
#define GC_DI_ROOF_CLOSED 255
#define GC_DI_WALL_OPEN 255
#define GC_DI_WALL_CLOSED 255
#define GC_DI_PRESSURE_OK 255
