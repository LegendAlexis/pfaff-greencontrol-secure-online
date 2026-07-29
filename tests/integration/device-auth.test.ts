import assert from "node:assert/strict";
import test from "node:test";

import {
  hashDeviceSecret,
  isAuthorizedDevice,
  readDeviceCredentials,
  verifyDeviceSecret,
} from "../../lib/domain/device-auth.ts";

const TEST_SECRET = "fixture-secret-not-used-by-any-device";

test("requires both device headers", () => {
  assert.equal(readDeviceCredentials(new Headers()), null);
  assert.equal(
    readDeviceCredentials(new Headers({ "x-device-id": "device-1" })),
    null,
  );
  assert.equal(
    readDeviceCredentials(
      new Headers({ "x-device-secret": TEST_SECRET }),
    ),
    null,
  );
});

test("trims and returns complete device credentials", () => {
  assert.deepEqual(
    readDeviceCredentials(
      new Headers({
        "x-device-id": " device-1 ",
        "x-device-secret": ` ${TEST_SECRET} `,
      }),
    ),
    { deviceId: "device-1", deviceSecret: TEST_SECRET },
  );
});

test("accepts only the matching secret", () => {
  const storedHash = hashDeviceSecret(TEST_SECRET);

  assert.equal(verifyDeviceSecret(TEST_SECRET, storedHash), true);
  assert.equal(verifyDeviceSecret("wrong-secret", storedHash), false);
});

test("rejects unknown and disabled devices", () => {
  const secretHash = hashDeviceSecret(TEST_SECRET);

  assert.equal(isAuthorizedDevice(null, TEST_SECRET), false);
  assert.equal(
    isAuthorizedDevice({ active: false, secret_hash: secretHash }, TEST_SECRET),
    false,
  );
  assert.equal(
    isAuthorizedDevice({ active: true, secret_hash: secretHash }, TEST_SECRET),
    true,
  );
});
