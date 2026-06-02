/**
 * Đổi mật khẩu bcrypt trong Postgres (đăng nhập legacy + đồng bộ Firebase riêng).
 *
 *   tsx scripts/set-user-password.ts --account admin --password '0979656177'
 */
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import { hashPassword } from "../lib/auth";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const account = arg("--account");
const password = arg("--password");

if (!account || !password) {
  console.error("Usage: tsx scripts/set-user-password.ts --account <phone> --password <pwd>");
  process.exit(1);
}

async function main() {
  const prisma = await createPrismaTiennuoc();
  try {
    const user = await prisma.user.findUnique({ where: { phone: account!.trim() } });
    if (!user) {
      console.error(`Không tìm thấy user: ${account}`);
      process.exit(1);
    }
    const passwordHash = await hashPassword(password!);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    console.log(`✓ Postgres: đã đổi mật khẩu cho "${user.phone}" (${user.role})`);
    console.log(
      `  Tiếp theo: npm run firebase:provision-auth -- --account ${account} --password '***'`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
