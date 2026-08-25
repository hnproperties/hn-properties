import { collectionRoutes } from '@/lib/api';
import { leadResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(leadResource);
