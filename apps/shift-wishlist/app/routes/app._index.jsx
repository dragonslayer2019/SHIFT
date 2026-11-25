import { authenticate } from '../shopify.server';

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="SHIFT Wishlist">
      <s-section heading="Wishlist backend">
        <s-paragraph>
          The signed App Proxy stores each logged-in customer&apos;s wishlist in an app-owned Customer metafield.
          Wishlist data is not stored in this app&apos;s database.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
