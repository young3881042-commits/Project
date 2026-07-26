export const DEVICE_PERMISSIONS = [
  "chat",
  "project:read",
  "file:write",
  "command:execute",
  "build:execute",
  "git",
] as const;

export type DevicePermission = (typeof DEVICE_PERMISSIONS)[number];
export type ThreadMode = "general" | "codex";

export interface DeviceRecord {
  id: string;
  name: string;
  tokenHash: string;
  permissions: DevicePermission[];
  createdAt: string;
  lastSeenAt: string;
  revokedAt?: string;
}

export interface PairCodeRecord {
  id: string;
  salt: string;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface PairRequestRecord {
  id: string;
  requestSecretHash: string;
  deviceName: string;
  requestedPermissions: DevicePermission[];
  approvedPermissions?: DevicePermission[];
  status: "pending" | "approved" | "rejected" | "claimed";
  createdAt: string;
  expiresAt: string;
  approvedAt?: string;
  claimedAt?: string;
  claimedDeviceId?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  realPath: string;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "awaiting-approval" | "streaming" | "completed" | "failed" | "cancelled";
  requestedPermissions?: DevicePermission[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BridgeEvent {
  id: number;
  type: string;
  threadId: string;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface TaskGrantRecord {
  approvalId: string;
  permissions: DevicePermission[];
  files: string[];
  commands: string[];
  createdAt: string;
}

export interface ThreadRecord {
  id: string;
  ownerDeviceId: string;
  mode: ThreadMode;
  projectId?: string;
  sdkThreadId?: string;
  title: string;
  status: "idle" | "awaiting-approval" | "running" | "failed";
  messages: MessageRecord[];
  events: BridgeEvent[];
  nextEventId: number;
  taskGrants: TaskGrantRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  threadId: string;
  deviceId: string;
  messageId: string;
  description: string;
  projectId?: string;
  files: string[];
  commands: string[];
  permissions: DevicePermission[];
  risk: "low" | "medium" | "high" | "critical";
  localWorkspaceAccess?: boolean;
  status: "pending" | "approved" | "rejected";
  scope?: "once" | "task";
  createdAt: string;
  decidedAt?: string;
}

export interface BridgeState {
  version: 1;
  bridgeId: string;
  bridgeName: string;
  devices: DeviceRecord[];
  pairCodes: PairCodeRecord[];
  pairRequests: PairRequestRecord[];
  projects: ProjectRecord[];
  threads: ThreadRecord[];
  approvals: ApprovalRecord[];
}

export interface AuthenticatedDevice {
  id: string;
  name: string;
  permissions: DevicePermission[];
}

export interface ApprovalContext {
  description?: string;
  files?: string[];
  commands?: string[];
}
