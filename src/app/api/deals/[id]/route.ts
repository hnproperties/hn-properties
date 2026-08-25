import { itemRoutes } from '@/lib/api';
import { dealResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(dealResource);
