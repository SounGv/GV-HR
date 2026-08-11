/** Great-circle distance in meters between two lat/lng points (haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Promise wrapper around the browser Geolocation API with Thai error
 * messages. Also enforces its own JS-side timeout on top of the native
 * `timeout` option — some Android/Chrome builds never fire either callback
 * when GPS signal is weak (a long-standing Geolocation API reliability
 * issue), which otherwise leaves this promise — and any UI awaiting it,
 * e.g. the mobile check-in wizard's "กำลังตรวจสอบตำแหน่ง…" step — hanging
 * forever instead of falling back to the offsite-reason flow.
 */
export function getCurrentPosition(
  options?: PositionOptions,
): Promise<GeolocationPosition> {
  const timeoutMs = options?.timeout ?? 10_000;
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง"));
      return;
    }

    let settled = false;
    const hardTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("หมดเวลาการระบุตำแหน่ง กรุณาลองใหม่"));
    }, timeoutMs + 2_000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        resolve(pos);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(hardTimeout);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อลงเวลา"
            : err.code === err.POSITION_UNAVAILABLE
              ? "ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่"
              : "หมดเวลาการระบุตำแหน่ง กรุณาลองใหม่";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0, ...options },
    );
  });
}
