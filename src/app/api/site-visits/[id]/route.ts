import { itemRoutes } from '@/lib/api';
import { siteVisitResource } from '@/lib/resources';

export const { GET, PATCH, DELETE } = itemRoutes(siteVisitResource);
