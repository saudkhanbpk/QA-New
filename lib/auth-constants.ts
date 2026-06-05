/**
 * List of super admin email addresses with access to the admin dashboard.
 * These are checked case-insensitively across the application.
 */
export const SUPER_ADMINS = [
    "admin@autoqa.com",
];

/**
 * Checks if a given email is in the SUPER_ADMINS list.
 * @param email The user email to check
 * @returns boolean indicating if the user is a super admin
 */
export const isSuperAdmin = (email: string | null | undefined): boolean => {
    if (!email) return false;
    const normalizedEmail = email.toLowerCase();
    return SUPER_ADMINS.some(admin => admin.toLowerCase() === normalizedEmail);
};
