// Zips go out in parts so one request stays inside the function limits.
// Kept apart from lib/media/zip so client components can share the number.
export const ZIP_PART_SIZE = 150;
