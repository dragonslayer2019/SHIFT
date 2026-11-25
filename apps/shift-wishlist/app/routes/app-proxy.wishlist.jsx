import process from 'node:process';
import { authenticate } from '../shopify.server';
import { handleWishlistRequest } from '../wishlist.server';

const scopeSecret = process.env.WISHLIST_SCOPE_SECRET || process.env.SHOPIFY_API_SECRET || '';

const handle = ({ request }) =>
  handleWishlistRequest(request, {
    authenticateAppProxy: authenticate.public.appProxy,
    scopeSecret,
  });

export const loader = handle;
export const action = handle;
