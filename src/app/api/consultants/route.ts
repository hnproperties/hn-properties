import { collectionRoutes } from '@/lib/api';
import { consultantResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(consultantResource);
