import { collectionRoutes } from '@/lib/api';
import { collaborationResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(collaborationResource);
