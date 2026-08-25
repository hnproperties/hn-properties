import { itemRoutes } from '@/lib/api';
import { ownerResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(ownerResource);
