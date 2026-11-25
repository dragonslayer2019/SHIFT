import db from '../db.server';
import { authenticate } from '../shopify.server';

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  if (topic === 'SHOP_REDACT') {
    await db.session.deleteMany({ where: { shop } });
  }

  console.info('Compliance webhook handled', { shop, topic });
  return new Response(null, { status: 200 });
};
