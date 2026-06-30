import "./_env";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";

// CLI de gestión de usuarios del cockpit. No hay registro público: las cuentas
// se crean y administran desde aquí. También resuelve el lockout de 2FA (perder
// el móvil) con `reset-2fa`, que fuerza un nuevo enrolamiento en el próximo login.
//
// Uso (vía npm scripts o tsx directamente):
//   tsx scripts/manage-users.ts create <email> <nombre> [password]
//   tsx scripts/manage-users.ts list
//   tsx scripts/manage-users.ts reset-password <email> [password]
//   tsx scripts/manage-users.ts reset-2fa <email>
//   tsx scripts/manage-users.ts delete <email>
//
// Si se omite [password], se genera una aleatoria y se imprime una sola vez.

const BCRYPT_ROUNDS = 12;

function generatePassword(): string {
  // 18 bytes → 24 chars base64url, sin caracteres ambiguos de relleno.
  return randomBytes(18).toString("base64url");
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

async function create(emailArg?: string, name?: string, passwordArg?: string) {
  if (!emailArg || !name) {
    throw new Error("Uso: create <email> <nombre> [password]");
  }
  const email = normalizeEmail(emailArg);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error(`Ya existe un usuario con email ${email}.`);

  const password = passwordArg ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.create({
    data: { email, name, passwordHash },
  });

  console.log(`✅ Usuario creado: ${email}`);
  if (!passwordArg) {
    console.log(`   Contraseña generada (guárdala, no se volverá a mostrar):`);
    console.log(`   ${password}`);
  }
  console.log(`   El 2FA se configurará en su primer inicio de sesión.`);
}

async function list() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { email: true, name: true, role: true, totpEnabled: true, createdAt: true },
  });
  if (users.length === 0) {
    console.log("No hay usuarios. Crea uno con: create <email> <nombre>");
    return;
  }
  console.table(
    users.map((u) => ({
      email: u.email,
      nombre: u.name,
      rol: u.role,
      "2FA": u.totpEnabled ? "activado" : "pendiente",
      creado: u.createdAt.toISOString().slice(0, 10),
    })),
  );
}

async function resetPassword(emailArg?: string, passwordArg?: string) {
  if (!emailArg) throw new Error("Uso: reset-password <email> [password]");
  const email = normalizeEmail(emailArg);
  const password = passwordArg ?? generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.update({ where: { email }, data: { passwordHash } });

  console.log(`✅ Contraseña actualizada para ${email}`);
  if (!passwordArg) {
    console.log(`   Nueva contraseña: ${password}`);
  }
}

async function reset2fa(emailArg?: string) {
  if (!emailArg) throw new Error("Uso: reset-2fa <email>");
  const email = normalizeEmail(emailArg);
  await prisma.user.update({
    where: { email },
    data: { totpSecret: null, totpEnabled: false },
  });
  console.log(`✅ 2FA reiniciado para ${email}. Volverá a configurarlo en el próximo login.`);
}

async function remove(emailArg?: string) {
  if (!emailArg) throw new Error("Uso: delete <email>");
  const email = normalizeEmail(emailArg);
  await prisma.user.delete({ where: { email } });
  console.log(`🗑️  Usuario eliminado: ${email}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "create":
      await create(args[0], args[1], args[2]);
      break;
    case "list":
      await list();
      break;
    case "reset-password":
      await resetPassword(args[0], args[1]);
      break;
    case "reset-2fa":
      await reset2fa(args[0]);
      break;
    case "delete":
      await remove(args[0]);
      break;
    default:
      console.log(
        [
          "Comandos disponibles:",
          "  create <email> <nombre> [password]   Crea un usuario",
          "  list                                 Lista los usuarios",
          "  reset-password <email> [password]    Cambia la contraseña",
          "  reset-2fa <email>                    Reinicia el 2FA (lockout)",
          "  delete <email>                       Elimina un usuario",
        ].join("\n"),
      );
      process.exitCode = command ? 1 : 0;
  }
}

main()
  .catch((err) => {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
