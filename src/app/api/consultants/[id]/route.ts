import { itemRoutes } from '@/lib/api';
import { consultantResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(consultantResource);
