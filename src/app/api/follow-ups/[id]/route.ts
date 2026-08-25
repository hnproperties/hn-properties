import { itemRoutes } from '@/lib/api';
import { followUpResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(followUpResource);
