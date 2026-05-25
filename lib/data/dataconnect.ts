import { getApps, initializeApp } from "firebase/app";
import { getDataConnect } from "firebase/data-connect";
import {
  connectorConfig,
  getUserByPhone,
  getUserByFirebaseUid,
  getUserById,
  upsertUserById,
  updateUserFirebaseUid,
  createAuditLog,
  type UserRole as DcUserRole,
} from "@/lib/generated/dataconnect";
import type { UserRole } from "@/lib/types/enums";

function getDataConnectInstance() {
  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }
  return getDataConnect(connectorConfig);
}

/** Gọi query/mutation NO_ACCESS — chỉ dùng sau khi đã xác thực session phía server. */
async function dc() {
  return getDataConnectInstance();
}

export type DcUserRow = {
  id: string;
  phone: string;
  firebaseUid?: string | null;
  passwordHash?: string | null;
  name: string;
  role: UserRole;
  householdId?: string;
};

function mapUser(u: {
  id: string;
  phone: string;
  firebaseUid?: string | null;
  passwordHash?: string | null;
  name: string;
  role: DcUserRole;
  household_on_user?: { id: string } | null;
}): DcUserRow {
  return {
    id: u.id,
    phone: u.phone,
    firebaseUid: u.firebaseUid,
    passwordHash: u.passwordHash,
    name: u.name,
    role: u.role as UserRole,
    householdId: u.household_on_user?.id,
  };
}

export async function dcFindUserByPhone(phone: string): Promise<DcUserRow | null> {
  const res = await getUserByPhone(await dc(), { phone });
  const u = res.data.users[0];
  return u ? mapUser(u) : null;
}

export async function dcFindUserByFirebaseUid(uid: string): Promise<DcUserRow | null> {
  const res = await getUserByFirebaseUid(await dc(), { uid });
  const u = res.data.users[0];
  return u ? mapUser(u) : null;
}

export async function dcFindUserById(id: string): Promise<DcUserRow | null> {
  const res = await getUserById(await dc(), { id });
  const u = res.data.user;
  if (!u) return null;
  return mapUser({ ...u, passwordHash: null, household_on_user: u.household_on_user ?? null });
}

export async function dcUpsertUser(params: {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  firebaseUid?: string;
  passwordHash?: string;
}): Promise<void> {
  await upsertUserById(await dc(), {
    id: params.id,
    phone: params.phone,
    name: params.name,
    role: params.role as DcUserRole,
    firebaseUid: params.firebaseUid ?? null,
    passwordHash: params.passwordHash ?? null,
  });
}

export async function dcLinkFirebaseUid(userId: string, firebaseUid: string): Promise<void> {
  const { updateUserFirebaseUid } = await import("@/lib/generated/dataconnect");
  await updateUserFirebaseUid(await dc(), { id: userId, firebaseUid });
}

export async function dcWriteAuditLog(params: {
  actorId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: string;
}): Promise<void> {
  await createAuditLog(await dc(), {
    actorId: params.actorId ?? null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? "{}",
  });
}
