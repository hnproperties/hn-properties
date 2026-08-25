import { itemRoutes } from '@/lib/api';
import { requirementResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(requirementResource);
