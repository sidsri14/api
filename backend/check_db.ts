import { prisma } from './src/utils/prisma.js';

async function check() {
  const users = await prisma.user.count();
  const sources = await prisma.paymentSource.count();
  const events = await prisma.paymentEvent.count();
  const failures = await prisma.failedPayment.count();

  console.log(`Users: ${users}`);
  console.log(`Sources: ${sources}`);
  console.log(`Events: ${events}`);
  console.log(`Failures: ${failures}`);

  if (failures > 0) {
    const lastFailure = await prisma.failedPayment.findFirst({ orderBy: { createdAt: 'desc' } });
    console.log('Last Failure:', JSON.stringify(lastFailure, null, 2));
  }
}

check();
