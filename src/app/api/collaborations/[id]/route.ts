import { itemRoutes } from '@/lib/api';
import { collaborationResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(collaborationResource);
