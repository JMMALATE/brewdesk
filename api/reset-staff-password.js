import { route } from './_lib/http.js';
import { resetStaffPassword } from './_lib/staff.js';

// POST /api/reset-staff-password — owner only
export default route(resetStaffPassword, { roles: ['owner'] });
