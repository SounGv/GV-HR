/** Promise wrapper around the browser Geolocation API with Thai error messages. */
export function getCurrentPosition(
  options?: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อลงเวลา"
            : err.code === err.POSITION_UNAVAILABLE
              ? "ไม่สามารถระบุตำแหน่งได้ กรุณาลองใหม่"
              : "หมดเวลาการระบุตำแหน่ง กรุณาลองใหม่";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0, ...options },
    );
  });
}
