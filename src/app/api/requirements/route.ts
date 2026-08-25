import { collectionRoutes } from '@/lib/api';
import { requirementResource } from '@/lib/resources';

export const { GET, POST } = collectionRoutes(requirementResource);
