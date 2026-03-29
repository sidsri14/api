const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const last = await prisma.failedPayment.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, customerEmail: true }
  });
  console.log(JSON.stringify(last));
  process.exit(0);
}
main();
