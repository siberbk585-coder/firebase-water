import { accountToAuthEmail, authEmailToAccount } from "./accountEmail";
import { type SessionUser, toSessionUser } from "./auth";
import { prisma } from "@/lib/data/prisma";
import { dcFindUserByFirebaseUid, dcLinkFirebaseUid } from "@/lib/data/dataconnect";
import { UserRole } from "@/lib/types/enums";
import { getAdminAuth } from "./firebase/admin";

export type FirebaseAuthRole = "ADMIN" | "RESIDENT";

export async function syncFirebaseRoleClaim(
  firebaseUid: string,
  role: UserRole
): Promise<void> {
  const claimRole: FirebaseAuthRole =
    role === UserRole.ADMIN ? "ADMIN" : "RESIDENT";
  await getAdminAuth().setCustomUserClaims(firebaseUid, { role: claimRole });
}

/** Xác thực ID token Firebase và ánh xạ sang User trong Postgres (phân quyền). */
export async function resolveSessionFromIdToken(
  idToken: string
): Promise<SessionUser | null> {
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  const uid = decoded.uid;

  let user =
    (await prisma.user.findUnique({
      where: { firebaseUid: uid },
      include: { household: true },
    })) ?? null;

  if (!user) {
    try {
      const dcUser = await dcFindUserByFirebaseUid(uid);
      if (dcUser) {
        user = await prisma.user.findUnique({
          where: { id: dcUser.id },
          include: { household: true },
        });
      }
    } catch {
      /* Data Connect chưa sẵn sàng — dùng Prisma */
    }
  }

  if (!user && decoded.email) {
    const account = authEmailToAccount(decoded.email);
    user = await prisma.user.findUnique({
      where: { phone: account },
      include: { household: true },
    });
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: uid },
        include: { household: true },
      });
      try {
        await dcLinkFirebaseUid(user.id, uid);
      } catch {
        /* bỏ qua nếu DC chưa deploy */
      }
    }
  }

  if (!user) return null;

  const claimRole = decoded.role as FirebaseAuthRole | undefined;
  if (claimRole && claimRole !== user.role) {
    return null;
  }

  await syncFirebaseRoleClaim(uid, user.role);
  return toSessionUser(user);
}

export async function ensureFirebaseUser(params: {
  account: string;
  password: string;
  role: UserRole;
  name: string;
}): Promise<{ firebaseUid: string; email: string }> {
  const email = accountToAuthEmail(params.account);
  const auth = getAdminAuth();

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password: params.password });
    await syncFirebaseRoleClaim(existing.uid, params.role);
    return { firebaseUid: existing.uid, email };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "";
    if (code !== "auth/user-not-found") throw e;
  }

  const created = await auth.createUser({
    email,
    password: params.password,
    displayName: params.name,
    emailVerified: true,
  });
  await syncFirebaseRoleClaim(created.uid, params.role);
  return { firebaseUid: created.uid, email };
}
