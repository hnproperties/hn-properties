import { collectionRoutes } from '@/lib/api';
import { siteVisitResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(siteVisitResource);
