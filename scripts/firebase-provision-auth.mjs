#!/usr/bin/env node
/**
 * Đồng bộ User Postgres → Firebase Auth (email/password + custom claim role).
 *
 *   node scripts/firebase-provision-auth.mjs
 *   node scripts/firebase-provision-auth.mjs --account admin --password '123456'
 *   node scripts/firebase-provision-auth.mjs --role ADMIN
 */
import { UserRole } from "@prisma/client";
import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createPrismaTiennuoc } from "./prisma-tiennuoc.ts";

const prisma = await createPrismaTiennuoc();

function initAdmin() {
  if (getApps().length) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const sa = JSON.parse(json);
    initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
    return;
  }
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tiennuoc",
  });
}

const DOMAIN = process.env.AUTH_EMAIL_DOMAIN || "accounts.tiennuoc.local";

function accountToEmail(account) {
  const t = account.trim().toLowerCase();
  if (t.includes("@")) return t;
  return `${t}@${DOMAIN}`;
}

async function syncUser(user, password) {
  const auth = getAuth();
  const email = accountToEmail(user.phone);
  const claimRole = user.role === UserRole.ADMIN ? "ADMIN" : "RESIDENT";
  const pwd = password || process.env.PROVISION_DEFAULT_PASSWORD || "123456";

  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password: pwd, displayName: user.name });
  } catch (e) {
    if (e?.code !== "auth/user-not-found") throw e;
    const created = await auth.createUser({
      email,
      password: pwd,
      displayName: user.name,
      emailVerified: true,
    });
    uid = created.uid;
  }

  await auth.setCustomUserClaims(uid, { role: claimRole });
  await prisma.user.update({
    where: { id: user.id },
    data: { firebaseUid: uid },
  });
  console.log(`✓ ${user.phone} (${user.role}) → ${email}`);
}

async function main() {
  initAdmin();
  const args = process.argv.slice(2);
  let account;
  let password;
  let roleFilter;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--account") account = args[++i];
    else if (args[i] === "--password") password = args[++i];
    else if (args[i] === "--role") roleFilter = args[++i];
  }

  if (account) {
    const user = await prisma.user.findUnique({ where: { phone: account } });
    if (!user) {
      console.error(`Không tìm thấy user phone=${account}`);
      process.exit(1);
    }
    await syncUser(user, password);
    return;
  }

  const where = roleFilter ? { role: roleFilter } : {};
  const users = await prisma.user.findMany({ where, orderBy: { phone: "asc" } });
  console.log(`Đồng bộ ${users.length} tài khoản...`);
  for (const u of users) {
    await syncUser(u, password);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
