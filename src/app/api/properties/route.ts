import { collectionRoutes } from '@/lib/api';
import { propertyResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(propertyResource);
