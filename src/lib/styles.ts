import type { CSSProperties } from "react";

export const cardShadow = "0 6px 18px -12px rgba(30,30,80,.3)";
export const cardShadowSm = "0 5px 14px -12px rgba(30,30,80,.3)";
export const darkShadow = "0 18px 34px -18px rgba(23,24,28,.7)";
export const backBtnShadow = "0 4px 12px -8px rgba(0,0,0,.3)";

export const backBtnStyle: CSSProperties = {
  width: 38,
  height: 38,
  border: "none",
  borderRadius: 12,
  background: "#fff",
  cursor: "pointer",
  boxShadow: backBtnShadow,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
