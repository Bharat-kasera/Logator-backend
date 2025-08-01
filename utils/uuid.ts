// UUID validation utility
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Validate UUID and return 400 error if invalid
export const validateUUIDParam = (uuid: string, paramName: string = 'ID'): { isValid: boolean; error?: { status: number; message: string } } => {
  if (!isValidUUID(uuid)) {
    return {
      isValid: false,
      error: {
        status: 400,
        message: `Invalid ${paramName} format`
      }
    };
  }
  return { isValid: true };
};