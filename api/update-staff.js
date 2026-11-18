import { route } from './_lib/http.js';
import { updateStaff } from './_lib/staff.js';

// POST /api/update-staff — owner only
export default route(updateStaff, { roles: ['owner'] });
