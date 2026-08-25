import { itemRoutes } from '@/lib/api';
import { listingResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(listingResource);
