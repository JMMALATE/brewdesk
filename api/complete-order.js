import { route } from './_lib/http.js';
import { completeOrder } from './_lib/orders.js';

// POST /api/complete-order — any active staff member
export default route(completeOrder);
