import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@my-common';

export const ALLOWED_ROLES_KEY = 'allowedRoles';

/**
 * Allowed Access Roles
 */
export const AllowedRoles = (...allowedRoles: UserRole[]) =>
  SetMetadata(ALLOWED_ROLES_KEY, allowedRoles);
