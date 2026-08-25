import { itemRoutes } from '@/lib/api';
import { propertyResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(propertyResource);
