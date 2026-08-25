import { collectionRoutes } from '@/lib/api';
import { ownerResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(ownerResource);
