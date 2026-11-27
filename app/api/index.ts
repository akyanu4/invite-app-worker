// Single entry point for every /api/... path (see the rewrite in vercel.json).
import { handle } from '../server/routes';

export default {
  fetch(request: Request) {
    return handle(request);
  },
};
