import { itemRoutes } from '@/lib/api';
import { clientResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(clientResource);
