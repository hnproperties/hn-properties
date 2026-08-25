import { collectionRoutes } from '@/lib/api';
import { dealResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(dealResource);
