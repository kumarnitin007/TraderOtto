/** Standard Wi-Fi join code. The password stays inside the QR and is not shown as text. */
export function wifiQrPayload(ssid: string, password: string): string {
  const network = escapeWifi(ssid);
  if (!password) return `WIFI:T:nopass;S:${network};;`;
  return `WIFI:T:WPA;S:${network};P:${escapeWifi(password)};;`;
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}
