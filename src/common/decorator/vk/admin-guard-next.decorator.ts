import { SetMetadata } from '@nestjs/common';

export const ADMIN_GUARD_NEXT = 'useAdminGuardNext';

/**
 * Access will be for any roles
 */
export const AdminGuardNext = () => SetMetadata(ADMIN_GUARD_NEXT, true);
