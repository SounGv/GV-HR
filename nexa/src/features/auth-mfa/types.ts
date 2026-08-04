export interface MfaStatus {
  enabled: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface MfaConfirmResponse {
  recoveryCodes: string[];
}
