export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
}

export interface ItemRequest {
  id: number;
  requestNumber: string;
  proposedCode: string;
  proposedName: string;
  itemType: string;
  category: string;
  uom: string;
  supplier?: string;
  supplierCode?: string;
  estimatedCost?: string;
  allergenFlags: string; // JSON string
  storageLocation?: string;
  shelfLife?: string;
  certifications?: string;
  businessReason: string;
  urgency: string;
  neededByDate?: string;
  status: string;
  masterplanCode?: string;
  approvedTemplate?: string;
  createdAt: string;
  updatedAt: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterDept?: string;
  approvals?: Approval[];
}

export interface Approval {
  id: number;
  decision: string;
  comments?: string;
  round: number;
  createdAt: string;
  approverName?: string;
  approverRole?: string;
}

export interface QaChecklist {
  id: number;
  checklistNumber: string;
  poNumber: string;
  supplierName: string;
  itemCode: string;
  itemDescription: string;
  quantityReceived: number;
  uom: string;
  lotNumber?: string;
  disposition: string;
  signedOffAt?: string;
  createdAt: string;
  qaUserName?: string;
}

export interface FgRelease {
  id: number;
  releaseNumber: string;
  productionOrderNum: string;
  itemCode: string;
  itemDescription: string;
  lotNumber: string;
  quantityProduced: number;
  uom: string;
  status: string;
  holdReason?: string;
  releasedAt?: string;
  createdAt: string;
  qaUserName?: string;
}

export interface SopDocument {
  id: number;
  docNumber: string;
  title: string;
  category: string;
  department: string;
  content: string;
  version: string;
  effectiveDate: string;
  reviewDate?: string;
  approvedBy?: string;
  active: boolean;
  acknowledgedByMe?: boolean;
}

export interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId?: number;
  description: string;
  metadata?: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
  userDept?: string;
}

export interface DashboardStats {
  itemRequests: {
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
    createdInErp: number;
  };
  qaReceiving: {
    today: number;
  };
  finishedGoods: {
    pendingQa: number;
    onHold: number;
    released: number;
    rejected: number;
  };
  recentActivity: AuditLog[];
}
