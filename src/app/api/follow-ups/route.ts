import { collectionRoutes } from '@/lib/api';
import { followUpResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(followUpResource);
