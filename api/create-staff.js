import { route } from './_lib/http.js';
import { createStaff } from './_lib/staff.js';

// POST /api/create-staff — owner only
export default route(createStaff, { roles: ['owner'] });
