import { itemRoutes } from '@/lib/api';
import { leadResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(leadResource);
