import { collectionRoutes } from '@/lib/api';
import { clientResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(clientResource);
