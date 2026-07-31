export type AssetStatus = "AVAILABLE" | "ASSIGNED" | "REPAIR" | "RETIRED";

export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  serialNumber: string | null;
  status: AssetStatus;
  assignedAt: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  note: string | null;
  assignedTo: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
}

export interface AssetFormValues {
  assetCode: string;
  name: string;
  category: string;
  serialNumber?: string;
  status: AssetStatus;
  purchaseDate?: string;
  purchasePrice?: string;
  note?: string;
}
